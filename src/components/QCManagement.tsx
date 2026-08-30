/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import CustomSelect from "./CustomSelect";
import { DtxMachine, QcRecord, QcLotConfig, MasterWard, StripReagentItem } from '../types';
import { dbService } from '../lib/supabase';
import { 
  SlidersVertical, Activity, Plus, TrendingUp, AlertTriangle, 
  CheckCircle2, Download, Settings, ChevronLeft, ChevronRight,
  Lightbulb, Eye, Check, Calendar, User, Zap, BarChart3, 
  FileSpreadsheet, ShieldAlert, Sparkles, Filter, RefreshCw,
  Clock, Hourglass, Bell, Send, Share2, Copy, AlertOctagon, Info,
  TableProperties, CheckSquare, Layers, Trash2, Calculator, Package,
  PackageCheck
} from 'lucide-react';

export interface LotExpInfo {
  lotNumber: string;
  expDate?: string;
  openDate?: string;
  openExpDays?: number;
  openExpiryDate?: string;
  effectiveExpDate?: string;
  daysRemaining?: number;
  status: 'expired' | 'critical' | 'warning' | 'valid' | 'unknown';
  statusText: string;
  colorClass: string;
  badgeBg: string;
}

export function calculateLotExpInfo(lot: QcLotConfig | undefined): LotExpInfo {
  if (!lot) {
    return {
      lotNumber: '-',
      status: 'unknown',
      statusText: 'ไม่พบข้อมูล LOT',
      colorClass: 'text-slate-400',
      badgeBg: 'bg-slate-100 text-slate-500 border-slate-200'
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let openExpiryDate: string | undefined = undefined;
  if (lot.openDate && lot.openExpDays) {
    const d = new Date(lot.openDate);
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + Number(lot.openExpDays));
      openExpiryDate = d.toISOString().split('T')[0];
    }
  }

  let effectiveExpDate: string | undefined = undefined;
  if (lot.expDate && openExpiryDate) {
    effectiveExpDate = lot.expDate < openExpiryDate ? lot.expDate : openExpiryDate;
  } else if (lot.expDate) {
    effectiveExpDate = lot.expDate;
  } else if (openExpiryDate) {
    effectiveExpDate = openExpiryDate;
  }

  if (!effectiveExpDate) {
    return {
      lotNumber: lot.lotNumber,
      expDate: lot.expDate,
      openDate: lot.openDate,
      openExpDays: lot.openExpDays,
      status: 'unknown',
      statusText: 'ยังไม่ระบุวันหมดอายุ',
      colorClass: 'text-slate-500',
      badgeBg: 'bg-slate-100 text-slate-600 border-slate-200'
    };
  }

  const expTime = new Date(effectiveExpDate).getTime();
  const diffTime = expTime - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return {
      lotNumber: lot.lotNumber,
      expDate: lot.expDate,
      openDate: lot.openDate,
      openExpDays: lot.openExpDays,
      openExpiryDate,
      effectiveExpDate,
      daysRemaining,
      status: 'expired',
      statusText: `หมดอายุแล้ว (${Math.abs(daysRemaining)} วันที่แล้ว)`,
      colorClass: 'text-rose-600',
      badgeBg: 'bg-rose-100 text-rose-800 border-rose-300'
    };
  }

  if (daysRemaining <= 7) {
    return {
      lotNumber: lot.lotNumber,
      expDate: lot.expDate,
      openDate: lot.openDate,
      openExpDays: lot.openExpDays,
      openExpiryDate,
      effectiveExpDate,
      daysRemaining,
      status: 'critical',
      statusText: `วิกฤต! หมดอายุใน ${daysRemaining} วัน`,
      colorClass: 'text-red-600',
      badgeBg: 'bg-red-100 text-red-800 border-red-300'
    };
  }

  if (daysRemaining <= 30) {
    return {
      lotNumber: lot.lotNumber,
      expDate: lot.expDate,
      openDate: lot.openDate,
      openExpDays: lot.openExpDays,
      openExpiryDate,
      effectiveExpDate,
      daysRemaining,
      status: 'warning',
      statusText: `ใกล้หมดอายุ (เหลือ ${daysRemaining} วัน)`,
      colorClass: 'text-amber-600',
      badgeBg: 'bg-amber-100 text-amber-800 border-amber-300'
    };
  }

  return {
    lotNumber: lot.lotNumber,
    expDate: lot.expDate,
    openDate: lot.openDate,
    openExpDays: lot.openExpDays,
    openExpiryDate,
    effectiveExpDate,
    daysRemaining,
    status: 'valid',
    statusText: `ปกติ (เหลือ ${daysRemaining} วัน)`,
    colorClass: 'text-emerald-600',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300'
  };
}

interface QCManagementProps {
  machines: DtxMachine[];
  qcRecords: QcRecord[];
  lotConfigs: QcLotConfig[];
  onAddQcRecord: (record: QcRecord) => void;
  onUpdateLotConfigs: (configs: QcLotConfig[]) => void;
  onDeleteLotConfig?: (lotNumber: string) => void;
  role?: string;
  initialTab?: 'batch' | 'history' | 'config';
}

export default function QCManagement({
  machines,
  qcRecords,
  lotConfigs,
  onAddQcRecord,
  onUpdateLotConfigs,
  onDeleteLotConfig,
  role = 'admin',
  initialTab = 'batch'
}: QCManagementProps) {
  // Main view tab: 'batch' (Batch/Spreadsheet Entry), 'history' (Log Table & LJ Chart), 'config' (Target Ranges)
  const [activeTab, setActiveTab] = useState<'batch' | 'history' | 'config'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [wards, setWards] = useState<MasterWard[]>([]);

  useEffect(() => {
    dbService.getWards()
      .then(setWards)
      .catch(err => console.error("Failed to fetch wards:", err));
  }, []);

  // Quick QC Entry Form States
  const [operator, setOperator] = useState<string>(() => localStorage.getItem('dtx_qc_operator') || '');
  const [qcDate, setQcDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedWard, setSelectedWard] = useState<string>('');
  const [selectedSerial, setSelectedSerial] = useState<string>('');
  const [selectedLot, setSelectedLot] = useState<string>('LOT2026-A');
  const [level1Val, setLevel1Val] = useState<string>('');
  const [level2Val, setLevel2Val] = useState<string>('');
  const [level3Val, setLevel3Val] = useState<string>('');
  const [entrySuccessToast, setEntrySuccessToast] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filter states for Chart and History
  const [filterWard, setFilterWard] = useState<string>('');
  const [filterLot, setFilterLot] = useState<string>('LOT2026-A');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'normal' | 'out_of_control'>('all');
  const [activeLevels, setActiveLevels] = useState<{ [key: number]: boolean }>({ 1: true, 2: true, 3: true });
  const [hoveredPoint, setHoveredPoint] = useState<{
    date: string;
    ward: string;
    serial: string;
    operator: string;
    level: number;
    val: number;
    target: number;
    sd: number;
    status: string;
    x: number;
    y: number;
  } | null>(null);

  // Pagination for History Table
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 15;

  // Reagent Strip Stock items source of truth
  const [stockItems, setStockItems] = useState<StripReagentItem[]>([]);
  const [isLoadingStock, setIsLoadingStock] = useState<boolean>(false);

  const loadStockItems = async () => {
    setIsLoadingStock(true);
    try {
      const items = await dbService.getStripReagentItems();
      if (Array.isArray(items)) {
        setStockItems(items);
      }
    } catch (err) {
      console.warn('Failed to load strip stock items in QCManagement:', err);
    } finally {
      setIsLoadingStock(false);
    }
  };

  useEffect(() => {
    loadStockItems();
  }, []);

  // Unique LOTs grouped from Reagent Strip Stock
  const stockLots = useMemo(() => {
    const map = new Map<string, {
      lotNumber: string;
      manufacturer: string;
      itemType: string;
      receivedDate?: string;
      expDate?: string;
      totalBoxes: number;
      inStockCount: number;
      inUseCount: number;
      depletedCount: number;
    }>();

    stockItems.forEach(item => {
      const lot = item.lotNumber?.trim();
      if (!lot) return;
      const key = lot.toUpperCase();
      const existing = map.get(key) || {
        lotNumber: lot,
        manufacturer: item.manufacturer || 'VivaChek Fad',
        itemType: item.itemType || 'strip',
        receivedDate: item.receivedDate,
        expDate: item.expDate,
        totalBoxes: 0,
        inStockCount: 0,
        inUseCount: 0,
        depletedCount: 0
      };
      existing.totalBoxes += 1;
      if (item.status === 'in_stock') existing.inStockCount += 1;
      else if (item.status === 'in_use') existing.inUseCount += 1;
      else if (item.status === 'depleted') existing.depletedCount += 1;
      if (!existing.expDate && item.expDate) existing.expDate = item.expDate;
      if (!existing.receivedDate && item.receivedDate) existing.receivedDate = item.receivedDate;
      map.set(key, existing);
    });

    return Array.from(map.values());
  }, [stockItems]);

  // Unified LOT list combining Reagent Strip Stock LOTs with QC Target Range configs
  const unifiedLotList = useMemo(() => {
    const map = new Map<string, {
      lotNumber: string;
      manufacturer?: string;
      itemType?: string;
      expDate?: string;
      openDate?: string;
      openExpDays?: number;
      receivedDate?: string;
      notes?: string;
      stockInfo?: {
        totalBoxes: number;
        inStockCount: number;
        inUseCount: number;
        depletedCount: number;
      };
      config?: QcLotConfig;
      isConfigured: boolean;
    }>();

    // 1. First add all LOTs physically present in Reagent Strip Stock
    stockLots.forEach(s => {
      const key = s.lotNumber.trim().toUpperCase();
      map.set(key, {
        lotNumber: s.lotNumber.trim(),
        manufacturer: s.manufacturer,
        itemType: s.itemType,
        expDate: s.expDate,
        receivedDate: s.receivedDate,
        stockInfo: {
          totalBoxes: s.totalBoxes,
          inStockCount: s.inStockCount,
          inUseCount: s.inUseCount,
          depletedCount: s.depletedCount
        },
        isConfigured: false
      });
    });

    // 2. Attach or merge existing QC Target Range configurations
    lotConfigs.forEach(cfg => {
      if (!cfg || !cfg.lotNumber) return;
      const key = cfg.lotNumber.trim().toUpperCase();
      const existing = map.get(key);
      if (existing) {
        existing.config = cfg;
        existing.isConfigured = true;
        if (!existing.expDate && cfg.expDate) existing.expDate = cfg.expDate;
        if (!existing.openDate && cfg.openDate) existing.openDate = cfg.openDate;
        if (!existing.notes && cfg.notes) existing.notes = cfg.notes;
        if (!existing.manufacturer && cfg.manufacturer) existing.manufacturer = cfg.manufacturer;
      } else {
        map.set(key, {
          lotNumber: cfg.lotNumber.trim(),
          manufacturer: cfg.manufacturer || 'VivaChek Fad',
          expDate: cfg.expDate,
          openDate: cfg.openDate,
          openExpDays: cfg.openExpDays,
          notes: cfg.notes,
          config: cfg,
          isConfigured: true
        });
      }
    });

    return Array.from(map.values());
  }, [stockLots, lotConfigs]);

  // Lot Config editing
  const [editingLotIdx, setEditingLotIdx] = useState<number | null>(null);
  const [editedLot, setEditedLot] = useState<QcLotConfig | null>(null);

  // Expired Control Submission Interceptor Dialog
  const [showExpiredPromptDialog, setShowExpiredPromptDialog] = useState<boolean>(false);
  const [pendingExpiredRecord, setPendingExpiredRecord] = useState<QcRecord | null>(null);
  const [pendingExpiredLotInfo, setPendingExpiredLotInfo] = useState<LotExpInfo | null>(null);

  // Calculate LOT Expiration details across all configs
  const allLotExpInfoList = useMemo(() => {
    return lotConfigs.map(calculateLotExpInfo);
  }, [lotConfigs]);

  // Expiring soon or expired lots
  const expiringOrExpiredLots = useMemo(() => {
    return allLotExpInfoList.filter(l => l.status === 'expired' || l.status === 'critical' || l.status === 'warning');
  }, [allLotExpInfoList]);

  // Auto-fill active lot config
  const activeLotConfig = useMemo(() => {
    return lotConfigs.find(c => c.lotNumber === selectedLot) || lotConfigs[0];
  }, [lotConfigs, selectedLot]);

  // Active selected lot expiration info
  const selectedLotExpInfo = useMemo(() => {
    return calculateLotExpInfo(activeLotConfig);
  }, [activeLotConfig]);

  // Save operator name for persistence
  const handleOperatorChange = (name: string) => {
    setOperator(name);
    localStorage.setItem('dtx_qc_operator', name);
  };

  // QC Scope quick switch ('all' | 'lab' | 'ward')
  const [qcScopeFilter, setQcScopeFilter] = useState<'all' | 'lab' | 'ward'>('all');

  // Batch QC Entry States
  const [batchScope, setBatchScope] = useState<'all' | 'lab' | 'ward'>('all');
  const [batchWardFilter, setBatchWardFilter] = useState<string>('');
  const [batchLot, setBatchLot] = useState<string>('LOT2026-A');
  const [batchDate, setBatchDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [batchRows, setBatchRows] = useState<Array<{
    machineId: string;
    serialNumber: string;
    ward: string;
    level1: string;
    level2: string;
    level3: string;
    selected: boolean;
  }>>([]);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState<boolean>(false);
  const [batchToast, setBatchToast] = useState<string>('');

  // Column Filter States under Batch Table Headers
  const [colFilterWard, setColFilterWard] = useState<string>('');
  const [colFilterSerial, setColFilterSerial] = useState<string>('');
  const [colFilterL1, setColFilterL1] = useState<string>('');
  const [colFilterL2, setColFilterL2] = useState<string>('');
  const [colFilterL3, setColFilterL3] = useState<string>('');
  const [colFilterStatus, setColFilterStatus] = useState<'all' | 'in_control' | 'out_control'>('all');

  // Toggle state for LJ Chart inside History view
  const [showLJChartSection, setShowLJChartSection] = useState<boolean>(true);

  // Synchronize batchRows when machines or filters change
  useEffect(() => {
    let list = machines;
    if (batchScope === 'lab') {
      list = list.filter(m => (m.ward && (m.ward.includes('LAB') || m.ward.includes('ชันสูตร') || m.ward.includes('ห้องปฏิบัติการ') || m.ward.includes('เทคนิคการแพทย์'))));
    } else if (batchScope === 'ward') {
      list = list.filter(m => !(m.ward && (m.ward.includes('LAB') || m.ward.includes('ชันสูตร') || m.ward.includes('ห้องปฏิบัติการ') || m.ward.includes('เทคนิคการแพทย์'))));
    }
    if (batchWardFilter) {
      list = list.filter(m => m.ward === batchWardFilter);
    }

    setBatchRows(prevRows => {
      const rowMap = new Map(prevRows.map(r => [r.serialNumber, r]));
      return list.map(m => {
        const existing = rowMap.get(m.serialNumber);
        return {
          machineId: m.id,
          serialNumber: m.serialNumber,
          ward: m.ward || 'ไม่ระบุ Ward',
          level1: existing ? existing.level1 : '',
          level2: existing ? existing.level2 : '',
          level3: existing ? existing.level3 : '',
          selected: existing ? existing.selected : true
        };
      });
    });
  }, [machines, batchScope, batchWardFilter]);

  // Dynamically filter batchRows based on table column filter inputs
  const filteredBatchRows = useMemo(() => {
    return batchRows.filter(row => {
      if (colFilterWard && !row.ward.toLowerCase().includes(colFilterWard.toLowerCase())) return false;
      if (colFilterSerial && !row.serialNumber.toLowerCase().includes(colFilterSerial.toLowerCase())) return false;
      if (colFilterL1 && !row.level1.includes(colFilterL1)) return false;
      if (colFilterL2 && !row.level2.includes(colFilterL2)) return false;
      if (colFilterL3 && !row.level3.includes(colFilterL3)) return false;

      if (colFilterStatus !== 'all') {
        const evaluateVal = (valStr: string, min: number, max: number, target: number, sd: number) => {
          if (!valStr.trim()) return 'pending';
          const val = Number(valStr);
          if (isNaN(val)) return 'pending';
          if (min !== undefined && max !== undefined && (min !== 0 || max !== 0)) {
            return (val < min || val > max) ? 'out_of_control' : 'normal';
          }
          return (val < target - 3 * sd || val > target + 3 * sd) ? 'out_of_control' : 'normal';
        };

        const l1Status = evaluateVal(row.level1, activeLotConfig?.level1Min || 0, activeLotConfig?.level1Max || 0, activeLotConfig?.level1Target || 0, activeLotConfig?.level1SD || 1);
        const l2Status = evaluateVal(row.level2, activeLotConfig?.level2Min || 0, activeLotConfig?.level2Max || 0, activeLotConfig?.level2Target || 0, activeLotConfig?.level2SD || 1);
        const l3Status = evaluateVal(row.level3, activeLotConfig?.level3Min || 0, activeLotConfig?.level3Max || 0, activeLotConfig?.level3Target || 0, activeLotConfig?.level3SD || 1);
        const hasOut = l1Status === 'out_of_control' || l2Status === 'out_of_control' || l3Status === 'out_of_control';
        const isComplete = row.level1.trim() && row.level2.trim() && row.level3.trim();

        if (colFilterStatus === 'in_control' && (!isComplete || hasOut)) return false;
        if (colFilterStatus === 'out_control' && (!isComplete || !hasOut)) return false;
      }
      return true;
    });
  }, [batchRows, colFilterWard, colFilterSerial, colFilterL1, colFilterL2, colFilterL3, colFilterStatus, activeLotConfig]);

  // Batch cell update helper
  const handleBatchCellChange = (serialNumber: string, field: 'level1' | 'level2' | 'level3', value: string) => {
    setBatchRows(rows => rows.map(r => r.serialNumber === serialNumber ? { ...r, [field]: value } : r));
  };

  // Toggle selection for single machine or all
  const handleToggleSelectRow = (serialNumber: string) => {
    setBatchRows(rows => rows.map(r => r.serialNumber === serialNumber ? { ...r, selected: !r.selected } : r));
  };

  const handleToggleSelectAllBatch = (select: boolean) => {
    setBatchRows(rows => rows.map(r => ({ ...r, selected: select })));
  };

  // Quick fill common values down for selected rows
  const handleBatchFillSample = (l1: number, l2: number, l3: number) => {
    setBatchRows(rows => rows.map(r => r.selected ? { ...r, level1: String(l1), level2: String(l2), level3: String(l3) } : r));
  };

  // Clear filled values
  const handleBatchClearValues = () => {
    setBatchRows(rows => rows.map(r => ({ ...r, level1: '', level2: '', level3: '' })));
  };

  // Batch Save Handler
  const handleBatchSubmit = async () => {
    if (!operator.trim()) {
      alert('กรุณาระบุชื่อผู้ลงบันทึก (Operator) ก่อนบันทึกข้อมูล');
      return;
    }

    // Filter rows that have all 3 levels filled and are selected
    const validRows = batchRows.filter(r => r.selected && r.level1.trim() && r.level2.trim() && r.level3.trim());

    if (validRows.length === 0) {
      alert('ไม่พบแถวที่มีข้อมูลครบทั้ง 3 ระดับ (Level 1, 2, 3) สำหรับการบันทึก กรุณากรอกผลในตาราง');
      return;
    }

    const config = lotConfigs.find(c => c.lotNumber === batchLot) || lotConfigs[0];
    if (!config) {
      alert('ไม่พบข้อมูล LOT Config');
      return;
    }

    const getStatus = (val: number, min: number, max: number, target: number, sd: number) => {
      if (min !== undefined && max !== undefined && (min !== 0 || max !== 0)) {
        return (val < min || val > max) ? 'out_of_control' : 'normal';
      }
      return (val < target - 3 * sd || val > target + 3 * sd) ? 'out_of_control' : 'normal';
    };

    setIsSubmittingBatch(true);
    try {
      let savedCount = 0;
      for (const row of validRows) {
        const l1 = Number(row.level1);
        const l2 = Number(row.level2);
        const l3 = Number(row.level3);

        const newRec: QcRecord = {
          id: `QC-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          date: batchDate,
          receiveDate: batchDate,
          returnDate: batchDate,
          ward: row.ward,
          serialNumber: row.serialNumber,
          operator: operator.trim(),
          lotNumber: batchLot,
          level1: l1,
          level2: l2,
          level3: l3,
          level1Status: getStatus(l1, config.level1Min, config.level1Max, config.level1Target, config.level1SD),
          level2Status: getStatus(l2, config.level2Min, config.level2Max, config.level2Target, config.level2SD),
          level3Status: getStatus(l3, config.level3Min, config.level3Max, config.level3Target, config.level3SD)
        };

        await onAddQcRecord(newRec);
        savedCount++;
      }

      setBatchToast(`✓ บันทึกผล QC แบบชุดสำเร็จทั้งหมด ${savedCount} เครื่อง (${batchLot})`);
      setTimeout(() => setBatchToast(''), 5000);

      // Clear values from the saved rows
      setBatchRows(rows => rows.map(r => validRows.some(vr => vr.serialNumber === r.serialNumber) ? { ...r, level1: '', level2: '', level3: '' } : r));
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดระหว่างการบันทึกผล QC แบบชุด');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  // Machines filtered by selected ward in quick entry
  const availableMachines = useMemo(() => {
    let list = machines;
    if (qcScopeFilter === 'lab') {
      list = list.filter(m => (m.ward && (m.ward.includes('LAB') || m.ward.includes('ชันสูตร') || m.ward.includes('ห้องปฏิบัติการ') || m.ward.includes('เทคนิคการแพทย์'))));
    } else if (qcScopeFilter === 'ward') {
      list = list.filter(m => !(m.ward && (m.ward.includes('LAB') || m.ward.includes('ชันสูตร') || m.ward.includes('ห้องปฏิบัติการ') || m.ward.includes('เทคนิคการแพทย์'))));
    }
    if (!selectedWard) return list;
    return list.filter(m => m.ward === selectedWard);
  }, [machines, selectedWard, qcScopeFilter]);

  // Handle Ward selection in entry form
  const handleEntryWardChange = (ward: string) => {
    setSelectedWard(ward);
    const wardMachines = machines.filter(m => m.ward === ward);
    if (wardMachines.length > 0) {
      setSelectedSerial(wardMachines[0].serialNumber);
      if (wardMachines[0].lotNumber) {
        setSelectedLot(wardMachines[0].lotNumber);
      }
    } else {
      setSelectedSerial('');
    }
  };

  // Handle Machine selection in entry form
  const handleEntrySerialChange = (serial: string) => {
    setSelectedSerial(serial);
    const m = machines.find(item => item.serialNumber === serial);
    if (m) {
      if (!selectedWard) setSelectedWard(m.ward);
      if (m.lotNumber) setSelectedLot(m.lotNumber);
    }
  };

  // Live evaluation of a level's value against config
  const evaluateValue = (valStr: string, min: number, max: number, target: number, sd: number) => {
    if (!valStr.trim()) return null;
    const val = Number(valStr);
    if (isNaN(val)) return 'invalid';

    if (min !== undefined && max !== undefined && (min !== 0 || max !== 0)) {
      return (val >= min && val <= max) ? 'normal' : 'out_of_control';
    }
    const low = target - 3 * (sd || 1);
    const high = target + 3 * (sd || 1);
    return (val >= low && val <= high) ? 'normal' : 'out_of_control';
  };

  const l1Eval = useMemo(() => {
    if (!activeLotConfig) return null;
    return evaluateValue(level1Val, activeLotConfig.level1Min, activeLotConfig.level1Max, activeLotConfig.level1Target, activeLotConfig.level1SD);
  }, [level1Val, activeLotConfig]);

  const l2Eval = useMemo(() => {
    if (!activeLotConfig) return null;
    return evaluateValue(level2Val, activeLotConfig.level2Min, activeLotConfig.level2Max, activeLotConfig.level2Target, activeLotConfig.level2SD);
  }, [level2Val, activeLotConfig]);

  const l3Eval = useMemo(() => {
    if (!activeLotConfig) return null;
    return evaluateValue(level3Val, activeLotConfig.level3Min, activeLotConfig.level3Max, activeLotConfig.level3Target, activeLotConfig.level3SD);
  }, [level3Val, activeLotConfig]);

  // Submit quick entry
  const handleAddQcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operator.trim()) {
      alert('กรุณาระบุชื่อผู้ลงบันทึก QC');
      return;
    }
    if (!selectedWard || !selectedSerial) {
      alert('กรุณาเลือกหน่วยงานและรหัสเครื่อง DTX');
      return;
    }
    if (!level1Val || !level2Val || !level3Val) {
      alert('กรุณากรอกผลการตรวจวัดให้ครบทั้ง 3 ระดับ (Level 1, 2, 3)');
      return;
    }

    const config = lotConfigs.find(c => c.lotNumber === selectedLot) || activeLotConfig;
    if (!config) {
      alert('ไม่พบข้อมูลการกำหนดค่าเป้าหมาย LOT นี้');
      return;
    }

    setIsSubmitting(true);

    const l1 = Number(level1Val);
    const l2 = Number(level2Val);
    const l3 = Number(level3Val);

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
      receiveDate: qcDate,
      returnDate: qcDate,
      ward: selectedWard,
      serialNumber: selectedSerial,
      operator: operator.trim(),
      lotNumber: selectedLot,
      level1: l1,
      level2: l2,
      level3: l3,
      level1Status,
      level2Status,
      level3Status
    };

    // Check if Control LOT is expired -> Prompt user and offer LINE alert
    if (selectedLotExpInfo.status === 'expired') {
      setPendingExpiredRecord(newRecord);
      setPendingExpiredLotInfo(selectedLotExpInfo);
      setShowExpiredPromptDialog(true);
      setIsSubmitting(false);
      return;
    }

    try {
      await onAddQcRecord(newRecord);
      setEntrySuccessToast(`✓ บันทึกผล QC เครื่อง ${selectedSerial} (${selectedWard}) สำเร็จ`);
      setTimeout(() => setEntrySuccessToast(''), 4000);

      // Reset values for next machine
      setLevel1Val('');
      setLevel2Val('');
      setLevel3Val('');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm save when control is expired
  const handleConfirmExpiredSave = async () => {
    if (!pendingExpiredRecord || !pendingExpiredLotInfo) return;
    setIsSubmitting(true);

    try {
      await onAddQcRecord(pendingExpiredRecord);
      setEntrySuccessToast(`✓ บันทึกผล QC เครื่อง ${pendingExpiredRecord.serialNumber} (${pendingExpiredRecord.ward}) เรียบร้อยแล้ว`);
      setTimeout(() => setEntrySuccessToast(''), 5000);

      setLevel1Val('');
      setLevel2Val('');
      setLevel3Val('');
      setShowExpiredPromptDialog(false);
      setPendingExpiredRecord(null);
      setPendingExpiredLotInfo(null);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle level in chart
  const toggleLevel = (lvl: number) => {
    setActiveLevels(prev => {
      const next = { ...prev, [lvl]: !prev[lvl] };
      if (!next[1] && !next[2] && !next[3]) return prev;
      return next;
    });
  };

  // Stats Calculations
  const getCalculatedStats = (records: QcRecord[], lot: string, level: 1 | 2 | 3, month: string, ward: string) => {
    const config = lotConfigs.find(c => c.lotNumber === lot);
    const filtered = records.filter(r =>
      r.lotNumber === lot &&
      (ward === '' || r.ward === ward) &&
      (month === '' || r.date.startsWith(month))
    );
    const values = filtered.map(r => level === 1 ? r.level1 : level === 2 ? r.level2 : r.level3);
    const n = values.length;

    if (n === 0) {
      return {
        n,
        mean: config ? (level === 1 ? config.level1Target : level === 2 ? config.level2Target : config.level3Target) : 0,
        sd: 0,
        cv: 0,
        outOfControlCount: 0,
        target: config ? (level === 1 ? config.level1Target : level === 2 ? config.level2Target : config.level3Target) : 0
      };
    }

    const mean = values.reduce((sum, v) => sum + v, 0) / n;
    let sd = 0;
    if (n > 1) {
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1);
      sd = Math.sqrt(variance);
    }
    const cv = mean > 0 ? (sd / mean) * 100 : 0;

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

  const level1Stats = useMemo(() => getCalculatedStats(qcRecords, filterLot, 1, filterMonth, filterWard), [qcRecords, filterLot, filterMonth, filterWard]);
  const level2Stats = useMemo(() => getCalculatedStats(qcRecords, filterLot, 2, filterMonth, filterWard), [qcRecords, filterLot, filterMonth, filterWard]);
  const level3Stats = useMemo(() => getCalculatedStats(qcRecords, filterLot, 3, filterMonth, filterWard), [qcRecords, filterLot, filterMonth, filterWard]);

  // Filtered History Table records
  const tableRecords = useMemo(() => {
    return qcRecords.filter(r => {
      const matchWard = filterWard === '' || r.ward === filterWard;
      const matchLot = filterLot === '' || r.lotNumber === filterLot;
      const matchMonth = filterMonth === '' || r.date.startsWith(filterMonth);
      const isOut = r.level1Status === 'out_of_control' || r.level2Status === 'out_of_control' || r.level3Status === 'out_of_control';
      const matchStatus = filterStatus === 'all' || (filterStatus === 'out_of_control' ? isOut : !isOut);
      return matchWard && matchLot && matchMonth && matchStatus;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [qcRecords, filterWard, filterLot, filterMonth, filterStatus]);

  const totalPages = Math.ceil(tableRecords.length / itemsPerPage);
  const paginatedQC = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return tableRecords.slice(start, start + itemsPerPage);
  }, [tableRecords, currentPage]);

  const availableMonths = useMemo(() => {
    const raw = qcRecords.map(r => r.date.substring(0, 7));
    return Array.from(new Set(raw)).sort((a, b) => b.localeCompare(a));
  }, [qcRecords]);

  // Today's summary records
  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayRecords = useMemo(() => {
    return qcRecords.filter(r => r.date === todayDateStr);
  }, [qcRecords, todayDateStr]);

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['วันที่', 'หน่วยงาน', 'รหัสเครื่อง DTX', 'LOT น้ำยา', 'ผู้ลงบันทึก', 'Level 1 (mg/dL)', 'Level 1 สถานะ', 'Level 2 (mg/dL)', 'Level 2 สถานะ', 'Level 3 (mg/dL)', 'Level 3 สถานะ'];
    const csvRows = [headers.join(',')];

    tableRecords.forEach(r => {
      const row = [
        r.date,
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
    link.setAttribute('download', `QC_Records_${filterLot}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Lot config management & Stock Target Range configuration
  const handleStartEditLot = (cfg: QcLotConfig) => {
    const idx = lotConfigs.findIndex(c => c.lotNumber === cfg.lotNumber);
    setEditingLotIdx(idx >= 0 ? idx : lotConfigs.length);
    setEditedLot({ ...cfg });
  };

  const handleStartConfigureStockLot = (lotNum: string) => {
    const stockInfo = stockLots.find(s => s.lotNumber === lotNum);
    const existingConfig = lotConfigs.find(c => c.lotNumber === lotNum);
    
    if (existingConfig) {
      const idx = lotConfigs.findIndex(c => c.lotNumber === lotNum);
      setEditingLotIdx(idx >= 0 ? idx : lotConfigs.length);
      setEditedLot({ ...existingConfig });
    } else {
      setEditingLotIdx(lotConfigs.length);
      setEditedLot({
        lotNumber: lotNum,
        manufacturer: stockInfo?.manufacturer || 'VivaChek Fad',
        expDate: stockInfo?.expDate || '',
        receivedDate: stockInfo?.receivedDate || '',
        openExpDays: 90,
        level1Target: 0, level1Min: 0, level1Max: 0, level1SD: 0,
        level2Target: 0, level2Min: 0, level2Max: 0, level2SD: 0,
        level3Target: 0, level3Min: 0, level3Max: 0, level3SD: 0,
      });
    }
  };

  const handleOpenAddLotModal = () => {
    // Pick first unconfigured stock lot, or first stock lot, or default
    const unconfigured = stockLots.find(s => !lotConfigs.some(lc => lc.lotNumber === s.lotNumber));
    const targetLot = unconfigured || stockLots[0];
    if (targetLot) {
      handleStartConfigureStockLot(targetLot.lotNumber);
    } else {
      setEditingLotIdx(lotConfigs.length);
      setEditedLot({
        lotNumber: '',
        manufacturer: 'VivaChek Fad',
        expDate: '',
        openExpDays: 90,
        level1Target: 0, level1Min: 0, level1Max: 0, level1SD: 0,
        level2Target: 0, level2Min: 0, level2Max: 0, level2SD: 0,
        level3Target: 0, level3Min: 0, level3Max: 0, level3SD: 0,
      });
    }
  };

  const handleDeleteLotConfig = async (lotNumber: string) => {
    if (!lotNumber || !lotNumber.trim()) return;
    const cleanLot = lotNumber.trim();
    const confirmed = window.confirm(`คุณต้องการลบการตั้งค่าช่วงค่ามาตรฐานสำหรับ LOT "${cleanLot}" ใช่หรือไม่?\n(ข้อมูลประวัติ QC เดิมจะยังคงอยู่)`);
    if (!confirmed) return;

    try {
      if (onDeleteLotConfig) {
        await onDeleteLotConfig(cleanLot);
      } else {
        await dbService.deleteLotConfig(cleanLot);
        const updatedConfigs = lotConfigs.filter(c => c.lotNumber.trim().toUpperCase() !== cleanLot.toUpperCase());
        onUpdateLotConfigs(updatedConfigs);
      }
      if (editingLotIdx !== null) {
        setEditingLotIdx(null);
        setEditedLot(null);
      }
      alert(`✓ ลบการตั้งค่าช่วงมาตรฐาน LOT ${cleanLot} สำเร็จเรียบร้อยแล้ว`);
    } catch (err: any) {
      console.error('Failed to delete lot config:', err);
      alert(`เกิดข้อผิดพลาดในการลบการตั้งค่า LOT: ${err?.message || err}`);
    }
  };

  // Dynamic automatic calculation of QC Target Range (Target/Mean, SD, Min, Max)
  const updateLevelValues = (
    level: 1 | 2 | 3,
    field: 'target' | 'sd' | 'min' | 'max',
    val: number
  ) => {
    if (!editedLot) return;
    
    const targetKey = `level${level}Target` as keyof QcLotConfig;
    const sdKey = `level${level}SD` as keyof QcLotConfig;
    const minKey = `level${level}Min` as keyof QcLotConfig;
    const maxKey = `level${level}Max` as keyof QcLotConfig;

    let target = (editedLot[targetKey] as number) || 0;
    let sd = (editedLot[sdKey] as number) || 0;
    let min = (editedLot[minKey] as number) || 0;
    let max = (editedLot[maxKey] as number) || 0;

    if (field === 'min') {
      min = val;
      if (min > 0 && max > min) {
        // Auto-calculate Mean/Target and SD from Min & Max (side of box range)
        target = Math.round(((min + max) / 2) * 10) / 10;
        sd = Math.round(((max - min) / 4) * 10) / 10;
      }
    } else if (field === 'max') {
      max = val;
      if (min > 0 && max > min) {
        // Auto-calculate Mean/Target and SD from Min & Max (side of box range)
        target = Math.round(((min + max) / 2) * 10) / 10;
        sd = Math.round(((max - min) / 4) * 10) / 10;
      }
    } else if (field === 'target') {
      target = val;
      if (target > 0 && sd > 0) {
        min = Math.max(0, Math.round((target - 2 * sd) * 10) / 10);
        max = Math.round((target + 2 * sd) * 10) / 10;
      } else if (target > 0 && min > 0 && target > min) {
        max = Math.round((target + (target - min)) * 10) / 10;
        sd = Math.round(((target - min) / 2) * 10) / 10;
      }
    } else if (field === 'sd') {
      sd = val;
      if (target > 0 && sd > 0) {
        min = Math.max(0, Math.round((target - 2 * sd) * 10) / 10);
        max = Math.round((target + 2 * sd) * 10) / 10;
      }
    }

    setEditedLot({
      ...editedLot,
      [targetKey]: target,
      [sdKey]: sd,
      [minKey]: min,
      [maxKey]: max,
    });
  };

  // Quick auto-calculate all levels from current Min & Max
  const handleAutoCalcAllLevels = () => {
    if (!editedLot) return;
    const updated: any = { ...editedLot };
    [1, 2, 3].forEach((lvl) => {
      const min = (updated[`level${lvl}Min`] as number) || 0;
      const max = (updated[`level${lvl}Max`] as number) || 0;
      if (min > 0 && max > min) {
        updated[`level${lvl}Target`] = Math.round(((min + max) / 2) * 10) / 10;
        updated[`level${lvl}SD`] = Math.round(((max - min) / 4) * 10) / 10;
      }
    });
    setEditedLot(updated);
  };

  const handleSaveLotConfig = () => {
    if (!editedLot || !editedLot.lotNumber.trim()) {
      alert('กรุณาระบุหรือเลือกล็อต (LOT Number)');
      return;
    }
    const cleanLot = editedLot.lotNumber.trim();
    const filtered = lotConfigs.filter(c => c.lotNumber.trim().toUpperCase() !== cleanLot.toUpperCase());
    const toSave: QcLotConfig = { ...editedLot, lotNumber: cleanLot };
    
    onUpdateLotConfigs([...filtered, toSave]);
    setEditingLotIdx(null);
    setEditedLot(null);
  };

  return (
    <div className="space-y-6" id="qc-management-redesigned">
      
      {/* Top Header & Navigation Tabs */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-800 flex items-center space-x-2">
            <Activity size={20} className="text-sky-600" />
            <span>ระบบควบคุมคุณภาพภายใน (IQC 3-Level POCT)</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            บันทึกผลการตรวจวิเคราะห์น้ำยาควบคุมคุณภาพ 3 ระดับ วิเคราะห์ Mean, SD, CV% และกราฟ Levey-Jennings
          </p>
        </div>

        {/* Tab Buttons Navigation Header */}
        <div className="w-full space-y-2">
          {/* Mobile Dropdown Navigation */}
          <div className="sm:hidden w-full">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-extrabold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer shadow-xs"
            >
              <option value="batch">📋 1. กรอกผลเป็นชุด (Batch Grid)</option>
              <option value="history">📈 2. ประวัติ IQC & กราฟ Levey-Jennings ({qcRecords.length})</option>
              <option value="config">⚙️ 3. ตั้งค่า LOT Strip & Target Range</option>
            </select>
          </div>

          {/* Desktop 3-Column Grid Navigation */}
          <div className="hidden sm:grid grid-cols-3 gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/90 w-full shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('batch')}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center space-x-2 cursor-pointer text-center ${
                activeTab === 'batch'
                  ? 'bg-sky-600 text-white shadow-xs ring-1 ring-sky-500'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <TableProperties size={15} className="shrink-0" />
              <span className="truncate">1. กรอกผลเป็นชุด</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center space-x-2 cursor-pointer text-center ${
                activeTab === 'history'
                  ? 'bg-sky-600 text-white shadow-xs ring-1 ring-sky-500'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <BarChart3 size={15} className="shrink-0" />
              <span className="truncate">2. ประวัติ IQC & กราฟ LJ ({qcRecords.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('config')}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center space-x-2 cursor-pointer text-center ${
                activeTab === 'config'
                  ? 'bg-amber-600 text-white shadow-xs ring-1 ring-amber-500'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Settings size={15} className="shrink-0" />
              <span className="truncate">3. Setting Range by LOT</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expiration Alert Banner (Critical / Warning / Expired Lots) */}
      {expiringOrExpiredLots.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border border-amber-300 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-start space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <AlertOctagon size={20} className="animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-slate-800">
                  แจ้งเตือน: พบ Control Lot ที่หมดอายุหรือใกล้หมดอายุ ({expiringOrExpiredLots.length} รายการ)
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                  Notify Exp
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {expiringOrExpiredLots.map((lotInfo, idx) => (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${lotInfo.badgeBg}`}
                  >
                    <Clock size={11} />
                    <span>LOT {lotInfo.lotNumber}: {lotInfo.statusText}</span>
                    {lotInfo.effectiveExpDate && <span className="opacity-75">({lotInfo.effectiveExpDate})</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('config')}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold px-3 py-2 rounded-xl flex items-center space-x-1 cursor-pointer transition-all"
            >
              <Settings size={14} />
              <span>จัดการ LOT</span>
            </button>
          </div>
        </div>
      )}

      {/* Success Notification Banner */}
      {entrySuccessToast && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{entrySuccessToast}</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-medium">บันทึกเรียบร้อย</span>
        </div>
      )}



      {/* VIEW 1: QUICK ENTRY FORM (REMOVED FROM ACTIVE TABS) */}
      {(activeTab as any) === 'entry' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="qc-quick-entry-view">
          
          {/* Left: Interactive Fast Entry Card (7 cols) */}
          <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-extrabold">
                  <Zap size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">ลงผลตรวจวัด QC รายเครื่อง</h3>
                  <p className="text-[11px] text-slate-400">ระบบจะวิเคราะห์ผล In Control / Out of Control ให้ทันทีขณะพิมพ์</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${selectedLotExpInfo.badgeBg}`}>
                  {selectedLot} ({selectedLotExpInfo.statusText})
                </span>
              </div>
            </div>

            {/* Selected LOT Expiration Warning Banner in Entry Form */}
            {selectedLotExpInfo.status === 'expired' && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs flex items-start gap-2.5 text-rose-900 animate-pulse">
                <AlertOctagon size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="block font-black">⛔ คำเตือน: Control {selectedLot} หมดอายุแล้ว!</strong>
                  <p className="text-[11px] text-rose-700">
                    หมดอายุเมื่อ {selectedLotExpInfo.effectiveExpDate} (เกินมา {Math.abs(selectedLotExpInfo.daysRemaining || 0)} วัน) กรุณาตรวจสอบหรือเปลี่ยนขวดใหม่
                  </p>
                </div>
              </div>
            )}
            {(selectedLotExpInfo.status === 'critical' || selectedLotExpInfo.status === 'warning') && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs flex items-start gap-2.5 text-amber-900">
                <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="block font-bold">⚠️ แจ้งเตือน: Control {selectedLot} ใกล้หมดอายุ</strong>
                  <p className="text-[11px] text-amber-700">
                    จะหมดอายุในอีก {selectedLotExpInfo.daysRemaining} วัน (วันที่ {selectedLotExpInfo.effectiveExpDate}) กรุณาเตรียมเบิกขวด LOT ใหม่
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleAddQcSubmit} className="space-y-4 text-xs">
              
              {/* Row 1: Operator (Remembered) & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <User size={13} className="text-sky-600" />
                      <span>ผู้ตรวจ / เจ้าหน้าที่ (Operator) *</span>
                    </span>
                    <span className="text-[10px] font-normal text-slate-400">จำชื่ออัตโนมัติ</span>
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น ทนพญ. สมิตา สิงห์สาด"
                    value={operator}
                    onChange={(e) => handleOperatorChange(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-sky-500 font-medium"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <Calendar size={13} className="text-sky-600" />
                    <span>วันที่ทดสอบ (Date) *</span>
                  </label>
                  <input
                    type="date"
                    value={qcDate}
                    onChange={(e) => setQcDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-sky-500 font-medium"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Scope pills & Ward & Machine Serial Selection & Control LOT */}
              <div className="space-y-2 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-slate-200/60">
                  <span className="text-[11px] font-bold text-slate-600">ขอบเขตเครื่องที่ตรวจ:</span>
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setQcScopeFilter('all');
                        setSelectedWard('');
                      }}
                      className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                        qcScopeFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      ทุกเครื่อง ({machines.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQcScopeFilter('lab');
                        const labWard = wards.find(w => w.thai_name.includes('LAB') || w.thai_name.includes('ชันสูตร') || w.thai_name.includes('ห้องปฏิบัติการ'))?.thai_name || '';
                        if (labWard) handleEntryWardChange(labWard);
                      }}
                      className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                        qcScopeFilter === 'lab' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      🔬 เครื่องงานชันสูตร (Lab Daily QC)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQcScopeFilter('ward');
                        setSelectedWard('');
                      }}
                      className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                        qcScopeFilter === 'ward' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      🏥 เครื่อง Ward (Ward POCT)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">1. เลือกหน่วยงาน (Ward) *</label>
                    <CustomSelect
                      value={selectedWard}
                      onChange={(e) => handleEntryWardChange(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-semibold"
                      required
                    >
                      <option value="">-- เลือกหน่วยงาน / Ward --</option>
                      {wards.map((w, idx) => (
                        <option key={idx} value={w.thai_name}>{w.thai_name}</option>
                      ))}
                    </CustomSelect>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">2. เลือกรหัสเครื่อง DTX *</label>
                    <CustomSelect
                      value={selectedSerial}
                      onChange={(e) => handleEntrySerialChange(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-sky-800"
                      required
                    >
                      <option value="">-- เลือกรหัสเครื่อง ({availableMachines.length}) --</option>
                      {availableMachines.map((m, idx) => (
                        <option key={idx} value={m.serialNumber}>
                          {m.serialNumber} {m.model ? `(${m.model})` : ''} - {m.ward}
                        </option>
                      ))}
                    </CustomSelect>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">3. ชุดน้ำยา (Control LOT) *</label>
                    <CustomSelect
                      value={selectedLot}
                      onChange={(e) => setSelectedLot(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-800"
                      required
                    >
                      {lotConfigs.map((cfg, idx) => {
                        const exp = calculateLotExpInfo(cfg);
                        return (
                          <option key={idx} value={cfg.lotNumber}>
                            {cfg.lotNumber} {exp.status === 'expired' ? '(⛔ หมดอายุ)' : exp.status === 'critical' || exp.status === 'warning' ? `(⚠️ เหลือ ${exp.daysRemaining} วัน)` : ''}
                          </option>
                        );
                      })}
                    </CustomSelect>
                  </div>
                </div>
              </div>

              {/* Row 3: Live 3-Level Input Cards with Real-time Feedback */}
              <div className="space-y-2 pt-1">
                <label className="font-extrabold text-slate-800 flex items-center justify-between">
                  <span>3. บันทึกผลการตรวจวัด 3 ระดับ (mg/dL)</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Target: L1={activeLotConfig?.level1Target} | L2={activeLotConfig?.level2Target} | L3={activeLotConfig?.level3Target}
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* Level 1 (Low) Input Card */}
                  <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-emerald-800">Level 1 (Low)</span>
                      <span className="text-[10px] text-emerald-700 font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                        {activeLotConfig?.level1Min}-{activeLotConfig?.level1Max}
                      </span>
                    </div>
                    <input
                      type="number"
                      step="any"
                      placeholder={`เป้าหมาย: ${activeLotConfig?.level1Target}`}
                      value={level1Val}
                      onChange={(e) => setLevel1Val(e.target.value)}
                      className="w-full text-sm font-black p-2.5 rounded-lg border border-emerald-300 bg-white text-emerald-950 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      required
                    />
                    <div className="min-h-[20px]">
                      {l1Eval === 'normal' && (
                        <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                          <Check size={11} className="mr-0.5" /> In control (ปกติ)
                        </span>
                      )}
                      {l1Eval === 'out_of_control' && (
                        <span className="inline-flex items-center text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md animate-pulse">
                          <AlertTriangle size={11} className="mr-0.5" /> Out of control!
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Level 2 (Normal) Input Card */}
                  <div className="p-3.5 rounded-xl border border-sky-200 bg-sky-50/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-sky-800">Level 2 (Normal)</span>
                      <span className="text-[10px] text-sky-700 font-bold bg-white px-1.5 py-0.5 rounded border border-sky-200">
                        {activeLotConfig?.level2Min}-{activeLotConfig?.level2Max}
                      </span>
                    </div>
                    <input
                      type="number"
                      step="any"
                      placeholder={`เป้าหมาย: ${activeLotConfig?.level2Target}`}
                      value={level2Val}
                      onChange={(e) => setLevel2Val(e.target.value)}
                      className="w-full text-sm font-black p-2.5 rounded-lg border border-sky-300 bg-white text-sky-950 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      required
                    />
                    <div className="min-h-[20px]">
                      {l2Eval === 'normal' && (
                        <span className="inline-flex items-center text-[10px] font-bold text-sky-700 bg-sky-100/90 px-2 py-0.5 rounded-md">
                          <Check size={11} className="mr-0.5" /> In control (ปกติ)
                        </span>
                      )}
                      {l2Eval === 'out_of_control' && (
                        <span className="inline-flex items-center text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md animate-pulse">
                          <AlertTriangle size={11} className="mr-0.5" /> Out of control!
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Level 3 (High) Input Card */}
                  <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-purple-800">Level 3 (High)</span>
                      <span className="text-[10px] text-purple-700 font-bold bg-white px-1.5 py-0.5 rounded border border-purple-200">
                        {activeLotConfig?.level3Min}-{activeLotConfig?.level3Max}
                      </span>
                    </div>
                    <input
                      type="number"
                      step="any"
                      placeholder={`เป้าหมาย: ${activeLotConfig?.level3Target}`}
                      value={level3Val}
                      onChange={(e) => setLevel3Val(e.target.value)}
                      className="w-full text-sm font-black p-2.5 rounded-lg border border-purple-300 bg-white text-purple-950 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      required
                    />
                    <div className="min-h-[20px]">
                      {l3Eval === 'normal' && (
                        <span className="inline-flex items-center text-[10px] font-bold text-purple-700 bg-purple-100/90 px-2 py-0.5 rounded-md">
                          <Check size={11} className="mr-0.5" /> In control (ปกติ)
                        </span>
                      )}
                      {l3Eval === 'out_of_control' && (
                        <span className="inline-flex items-center text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md animate-pulse">
                          <AlertTriangle size={11} className="mr-0.5" /> Out of control!
                        </span>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-extrabold py-3 rounded-xl transition-all shadow-md shadow-sky-500/20 flex items-center justify-center space-x-2 cursor-pointer text-xs"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>กำลังบันทึกข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>บันทึกผลการทดสอบ QC เครื่องนี้</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right: Today's Logged Summary & Active Stats (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Quick Stats Banner */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">สถิติการรัน QC วันนี้ ({todayDateStr})</span>
                <span className="text-xs font-black bg-sky-500 text-white px-2.5 py-0.5 rounded-full">
                  {todayRecords.length} เครื่อง
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-slate-700/60">
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/50">
                  <span className="text-[10px] text-emerald-400 font-bold block">Level 1 Mean</span>
                  <span className="text-sm font-extrabold text-white">
                    {todayRecords.length > 0 ? (todayRecords.reduce((s, r) => s + r.level1, 0) / todayRecords.length).toFixed(1) : '-'}
                  </span>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/50">
                  <span className="text-[10px] text-sky-400 font-bold block">Level 2 Mean</span>
                  <span className="text-sm font-extrabold text-white">
                    {todayRecords.length > 0 ? (todayRecords.reduce((s, r) => s + r.level2, 0) / todayRecords.length).toFixed(1) : '-'}
                  </span>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/50">
                  <span className="text-[10px] text-purple-400 font-bold block">Level 3 Mean</span>
                  <span className="text-sm font-extrabold text-white">
                    {todayRecords.length > 0 ? (todayRecords.reduce((s, r) => s + r.level3, 0) / todayRecords.length).toFixed(1) : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* List of Machines logged today */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <span>รายการที่ลงผลแล้ววันนี้</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="text-[11px] font-bold text-sky-600 hover:text-sky-800 hover:underline"
                >
                  ดูทั้งหมด →
                </button>
              </div>

              {todayRecords.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <Activity size={24} className="mx-auto text-slate-300 mb-1.5" />
                  <span>ยังไม่มีการลงบันทึกผล QC ในวันนี้</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {todayRecords.slice(0, 6).map((rec, idx) => {
                    const isOut = rec.level1Status === 'out_of_control' || rec.level2Status === 'out_of_control' || rec.level3Status === 'out_of_control';
                    return (
                      <div key={idx} className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="font-extrabold text-slate-800 flex items-center space-x-1.5">
                            <span>{rec.serialNumber}</span>
                            <span className="text-[10px] font-medium text-slate-500">({rec.ward})</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            L1: <strong className="text-emerald-700">{rec.level1}</strong> | L2: <strong className="text-sky-700">{rec.level2}</strong> | L3: <strong className="text-purple-700">{rec.level3}</strong>
                          </div>
                        </div>
                        <div>
                          {isOut ? (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                              Out of control
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              In control
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* VIEW 1.5: BATCH SPREADSHEET ENTRY FOR MULTIPLE MACHINES */}
      {activeTab === 'batch' && (
        <div className="space-y-4" id="qc-batch-entry-view">
          
          {/* Batch Control Header & Tooling Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
            
            {/* Top Row: Meta Controls (Date, Lot, Operator, Ward Filter) */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <TableProperties size={18} className="text-sky-600" />
                  <span>บันทึกผล QC พร้อมกันหลายเครื่อง (Batch Grid Entry)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ช่วยให้เจ้าหน้าที่/แอดมิน กรอกผล QC รอบเช้าหรือรอบเดือนทุกเครื่องในคราวเดียวได้รวดเร็วเหมือน Excel
                </p>
              </div>

              {/* Operator info */}
              <div className="flex items-center gap-2">
                <div className="flex items-center space-x-1.5 text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                  <User size={13} className="text-sky-600" />
                  <span className="text-slate-500 font-medium">ผู้ตรวจ:</span>
                  <input
                    type="text"
                    value={operator}
                    onChange={(e) => handleOperatorChange(e.target.value)}
                    placeholder="ระบุชื่อเจ้าหน้าที่"
                    className="font-bold text-slate-800 bg-transparent border-none focus:outline-none w-36 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Filter and Quick Fill Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Date */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-500 font-medium">วันที่ตรวจ:</span>
                  <input
                    type="date"
                    value={batchDate}
                    onChange={(e) => setBatchDate(e.target.value)}
                    className="text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 font-bold"
                  />
                </div>

                {/* LOT */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-500 font-medium">Control LOT:</span>
                  <CustomSelect
                    value={batchLot}
                    onChange={(e) => setBatchLot(e.target.value)}
                    className="text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 font-bold min-w-[130px]"
                  >
                    {lotConfigs.map((cfg, idx) => (
                      <option key={idx} value={cfg.lotNumber}>{cfg.lotNumber}</option>
                    ))}
                  </CustomSelect>
                </div>

                {/* Scope Switcher */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-500 font-medium">กลุ่มเครื่อง:</span>
                  <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setBatchScope('all')}
                      className={`px-2.5 py-1 rounded-md transition-all ${batchScope === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      ทั้งหมด ({machines.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchScope('lab')}
                      className={`px-2.5 py-1 rounded-md transition-all ${batchScope === 'lab' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      เฉพาะแล็บ
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchScope('ward')}
                      className={`px-2.5 py-1 rounded-md transition-all ${batchScope === 'ward' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      เฉพาะ Ward
                    </button>
                  </div>
                </div>

                {/* Ward Filter */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-500 font-medium">Ward:</span>
                  <CustomSelect
                    value={batchWardFilter}
                    onChange={(e) => setBatchWardFilter(e.target.value)}
                    className="text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 font-semibold min-w-[140px]"
                  >
                    <option value="">-- ทุก Ward --</option>
                    {wards.map((w, idx) => (
                      <option key={idx} value={w.thai_name}>{w.thai_name}</option>
                    ))}
                  </CustomSelect>
                </div>
              </div>

              {/* Quick Helper Tools */}
              <div className="flex items-center gap-2 flex-wrap">
                {activeLotConfig && (
                  <button
                    type="button"
                    onClick={() => handleBatchFillSample(activeLotConfig.level1Target, activeLotConfig.level2Target, activeLotConfig.level3Target)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-bold flex items-center space-x-1 cursor-pointer transition-all"
                    title="กรอกค่า Target เป็นค่าเริ่มต้นลงในเครื่องที่เลือก"
                  >
                    <Sparkles size={13} className="text-amber-500" />
                    <span>เติมค่า Target อัตโนมัติ</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleBatchClearValues}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-bold flex items-center space-x-1 cursor-pointer transition-all"
                >
                  <Trash2 size={13} className="text-rose-500" />
                  <span>ล้างค่าที่กรอก</span>
                </button>
              </div>

            </div>

            {/* Target Ranges Helper Bar */}
            {activeLotConfig && (
              <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs flex-wrap gap-2">
                <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
                  <Info size={14} className="text-sky-600" />
                  <span>เกณฑ์ประเมิน LOT {batchLot}:</span>
                </span>
                <div className="flex items-center gap-3 font-mono text-[11px] font-bold">
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    L1 Target: {activeLotConfig.level1Target} ({activeLotConfig.level1Min}-{activeLotConfig.level1Max})
                  </span>
                  <span className="text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                    L2 Target: {activeLotConfig.level2Target} ({activeLotConfig.level2Min}-{activeLotConfig.level2Max})
                  </span>
                  <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    L3 Target: {activeLotConfig.level3Target} ({activeLotConfig.level3Min}-{activeLotConfig.level3Max})
                  </span>
                </div>
              </div>
            )}

          </div>

          {/* Toast Notification */}
          {batchToast && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs animate-fade-in">
              <div className="flex items-center space-x-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{batchToast}</span>
              </div>
            </div>
          )}

          {/* Spreadsheet Table Grid */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/90 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="py-3 px-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredBatchRows.length > 0 && filteredBatchRows.every(r => r.selected)}
                        onChange={(e) => handleToggleSelectAllBatch(e.target.checked)}
                        className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3.5 w-12 text-center">#</th>
                    <th className="py-3 px-3.5">หน่วยงาน (Ward)</th>
                    <th className="py-3 px-3.5 font-mono">รหัสเครื่อง DTX (S/N)</th>
                    <th className="py-3 px-3.5 text-center bg-emerald-50/50 text-emerald-900 w-36">Level 1 (Low)</th>
                    <th className="py-3 px-3.5 text-center bg-sky-50/50 text-sky-900 w-36">Level 2 (Normal)</th>
                    <th className="py-3 px-3.5 text-center bg-purple-50/50 text-purple-900 w-36">Level 3 (High)</th>
                    <th className="py-3 px-3.5 text-center w-28">สถานะประเมิน</th>
                  </tr>

                  {/* Header Column Filters Row */}
                  <tr className="bg-slate-100/90 border-b border-slate-200">
                    <td className="py-1.5 px-2 text-center text-[10px] text-slate-400 font-bold">กรอง:</td>
                    <td className="py-1.5 px-2 text-center text-[10px] text-slate-400 font-mono">🔍</td>
                    <td className="py-1.5 px-2">
                      <input
                        type="text"
                        placeholder="กรอง Ward..."
                        value={colFilterWard}
                        onChange={(e) => setColFilterWard(e.target.value)}
                        className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white font-medium focus:ring-1 focus:ring-sky-500"
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <input
                        type="text"
                        placeholder="กรอง S/N..."
                        value={colFilterSerial}
                        onChange={(e) => setColFilterSerial(e.target.value)}
                        className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white font-mono font-medium focus:ring-1 focus:ring-sky-500"
                      />
                    </td>
                    <td className="py-1.5 px-2 bg-emerald-50/30">
                      <input
                        type="text"
                        placeholder="กรอง L1..."
                        value={colFilterL1}
                        onChange={(e) => setColFilterL1(e.target.value)}
                        className="w-full text-xs px-2 py-1 rounded-lg border border-emerald-200 bg-white text-center font-mono font-medium"
                      />
                    </td>
                    <td className="py-1.5 px-2 bg-sky-50/30">
                      <input
                        type="text"
                        placeholder="กรอง L2..."
                        value={colFilterL2}
                        onChange={(e) => setColFilterL2(e.target.value)}
                        className="w-full text-xs px-2 py-1 rounded-lg border border-sky-200 bg-white text-center font-mono font-medium"
                      />
                    </td>
                    <td className="py-1.5 px-2 bg-purple-50/30">
                      <input
                        type="text"
                        placeholder="กรอง L3..."
                        value={colFilterL3}
                        onChange={(e) => setColFilterL3(e.target.value)}
                        className="w-full text-xs px-2 py-1 rounded-lg border border-purple-200 bg-white text-center font-mono font-medium"
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <select
                        value={colFilterStatus}
                        onChange={(e) => setColFilterStatus(e.target.value as any)}
                        className="w-full text-[11px] px-1.5 py-1 rounded-lg border border-slate-200 bg-white font-bold cursor-pointer"
                      >
                        <option value="all">ทุกสถานะ</option>
                        <option value="in_control">✓ In Control</option>
                        <option value="out_control">⚠️ Out Control</option>
                      </select>
                    </td>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredBatchRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">
                        ไม่พบรายการเครื่อง DTX ตามเงื่อนไขที่กรอง
                      </td>
                    </tr>
                  ) : (
                    filteredBatchRows.map((row, idx) => {
                      const l1Status = evaluateValue(row.level1, activeLotConfig?.level1Min || 0, activeLotConfig?.level1Max || 0, activeLotConfig?.level1Target || 0, activeLotConfig?.level1SD || 1);
                      const l2Status = evaluateValue(row.level2, activeLotConfig?.level2Min || 0, activeLotConfig?.level2Max || 0, activeLotConfig?.level2Target || 0, activeLotConfig?.level2SD || 1);
                      const l3Status = evaluateValue(row.level3, activeLotConfig?.level3Min || 0, activeLotConfig?.level3Max || 0, activeLotConfig?.level3Target || 0, activeLotConfig?.level3SD || 1);
                      
                      const isComplete = row.level1.trim() && row.level2.trim() && row.level3.trim();
                      const hasOut = l1Status === 'out_of_control' || l2Status === 'out_of_control' || l3Status === 'out_of_control';

                      return (
                        <tr
                          key={row.serialNumber}
                          className={`hover:bg-slate-50/70 transition-colors ${row.selected ? 'bg-white' : 'bg-slate-50/40 opacity-60'}`}
                        >
                          <td className="py-2 px-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={() => handleToggleSelectRow(row.serialNumber)}
                              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-3.5 text-center text-slate-400 text-[11px] font-mono">{idx + 1}</td>
                          <td className="py-2 px-3.5 text-slate-900 font-bold">{row.ward}</td>
                          <td className="py-2 px-3.5 text-sky-800 font-mono font-bold">{row.serialNumber}</td>
                          
                          {/* Level 1 Cell */}
                          <td className="py-1.5 px-2 bg-emerald-50/30">
                            <input
                              type="number"
                              step="0.1"
                              value={row.level1}
                              disabled={!row.selected}
                              onChange={(e) => handleBatchCellChange(row.serialNumber, 'level1', e.target.value)}
                              placeholder={activeLotConfig ? String(activeLotConfig.level1Target) : '-'}
                              className={`w-full text-center font-mono font-bold text-xs p-1.5 rounded-lg border transition-all ${
                                l1Status === 'out_of_control'
                                  ? 'border-rose-400 bg-rose-50 text-rose-800'
                                  : l1Status === 'normal'
                                  ? 'border-emerald-300 bg-emerald-50/80 text-emerald-900'
                                  : 'border-slate-200 bg-white'
                              }`}
                            />
                          </td>

                          {/* Level 2 Cell */}
                          <td className="py-1.5 px-2 bg-sky-50/30">
                            <input
                              type="number"
                              step="0.1"
                              value={row.level2}
                              disabled={!row.selected}
                              onChange={(e) => handleBatchCellChange(row.serialNumber, 'level2', e.target.value)}
                              placeholder={activeLotConfig ? String(activeLotConfig.level2Target) : '-'}
                              className={`w-full text-center font-mono font-bold text-xs p-1.5 rounded-lg border transition-all ${
                                l2Status === 'out_of_control'
                                  ? 'border-rose-400 bg-rose-50 text-rose-800'
                                  : l2Status === 'normal'
                                  ? 'border-sky-300 bg-sky-50/80 text-sky-900'
                                  : 'border-slate-200 bg-white'
                              }`}
                            />
                          </td>

                          {/* Level 3 Cell */}
                          <td className="py-1.5 px-2 bg-purple-50/30">
                            <input
                              type="number"
                              step="0.1"
                              value={row.level3}
                              disabled={!row.selected}
                              onChange={(e) => handleBatchCellChange(row.serialNumber, 'level3', e.target.value)}
                              placeholder={activeLotConfig ? String(activeLotConfig.level3Target) : '-'}
                              className={`w-full text-center font-mono font-bold text-xs p-1.5 rounded-lg border transition-all ${
                                l3Status === 'out_of_control'
                                  ? 'border-rose-400 bg-rose-50 text-rose-800'
                                  : l3Status === 'normal'
                                  ? 'border-purple-300 bg-purple-50/80 text-purple-900'
                                  : 'border-slate-200 bg-white'
                              }`}
                            />
                          </td>

                          {/* Status badge */}
                          <td className="py-2 px-3 text-center">
                            {!isComplete ? (
                              <span className="text-[10px] text-slate-400 font-medium">- รอกรอก -</span>
                            ) : hasOut ? (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                                Out Control
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                In Control
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Submit Action Bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                พร้อมบันทึก: <strong className="text-sky-700">{batchRows.filter(r => r.selected && r.level1.trim() && r.level2.trim() && r.level3.trim()).length}</strong> จาก {batchRows.filter(r => r.selected).length} เครื่องที่เลือก
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmittingBatch || batchRows.filter(r => r.selected && r.level1.trim() && r.level2.trim() && r.level3.trim()).length === 0}
                  onClick={handleBatchSubmit}
                  className="bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs px-6 py-2.5 rounded-xl flex items-center space-x-2 cursor-pointer shadow-md shadow-sky-500/20 disabled:opacity-50 transition-all"
                >
                  {isSubmittingBatch ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>กำลังบันทึกข้อมูลชุด...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      <span>บันทึกผล QC ทั้งหมดที่กรอก ({batchRows.filter(r => r.selected && r.level1.trim() && r.level2.trim() && r.level3.trim()).length} เครื่อง)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* VIEW 2: QC RECORDS HISTORY TABLE & EXPANDABLE LEVEY-JENNINGS CHART */}
      {activeTab === 'history' && (
        <div className="space-y-6" id="qc-history-view">
          
          {/* Header Bar with Toggle LJ Chart Button */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-black shrink-0">
                <BarChart3 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">
                  ประวัติผลตรวจ IQC & กราฟควบคุมคุณภาพ Levey-Jennings
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  แสดงตารางประวัติผลตรวจย้อนหลัง พร้อมเครื่องมือขยายดูวิเคราะห์กราฟ LJ Chart & สถิติ (Mean, SD, CV%)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowLJChartSection(!showLJChartSection)}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all cursor-pointer shadow-xs ${
                showLJChartSection 
                  ? 'bg-slate-800 text-white hover:bg-slate-700' 
                  : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-500/20'
              }`}
            >
              <BarChart3 size={15} />
              <span>{showLJChartSection ? '▲ ซ่อนกราฟ LJ Chart' : '📈 แสดงกราฟ LJ Chart & สถิติ'}</span>
            </button>
          </div>

          {/* Expandable LJ Chart Section */}
          {showLJChartSection && (
            <div className="space-y-6 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 animate-fade-in">
              
              {/* Chart Filter Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-1 font-bold text-slate-700">
                <Filter size={14} className="text-sky-600" />
                <span>ตัวกรองกราฟ:</span>
              </div>

              {/* Month */}
              <div className="flex items-center space-x-1">
                <span className="text-slate-500 font-medium">เดือน:</span>
                <CustomSelect
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 font-semibold min-w-[120px]"
                >
                  <option value="">-- ทุกเดือน --</option>
                  {availableMonths.map((m, idx) => (
                    <option key={idx} value={m}>{m}</option>
                  ))}
                </CustomSelect>
              </div>

              {/* Ward */}
              <div className="flex items-center space-x-1">
                <span className="text-slate-500 font-medium">หน่วยงาน:</span>
                <CustomSelect
                  value={filterWard}
                  onChange={(e) => setFilterWard(e.target.value)}
                  className="text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 font-semibold min-w-[150px]"
                >
                  <option value="">-- ทุกหน่วยงาน --</option>
                  {wards.map((w, idx) => (
                    <option key={idx} value={w.thai_name}>{w.thai_name}</option>
                  ))}
                </CustomSelect>
              </div>

              {/* Lot */}
              <div className="flex items-center space-x-1">
                <span className="text-slate-500 font-medium">LOT:</span>
                <CustomSelect
                  value={filterLot}
                  onChange={(e) => setFilterLot(e.target.value)}
                  className="text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 font-semibold min-w-[120px]"
                >
                  {lotConfigs.map((c, idx) => (
                    <option key={idx} value={c.lotNumber}>{c.lotNumber}</option>
                  ))}
                </CustomSelect>
              </div>
            </div>

            {/* Level Toggle Chips */}
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold text-slate-500">แสดงระดับ:</span>
              <button
                type="button"
                onClick={() => toggleLevel(1)}
                className={`px-2.5 py-1 rounded-lg font-extrabold text-[11px] border cursor-pointer transition-all ${
                  activeLevels[1] ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-white text-slate-400 border-slate-200'
                }`}
              >
                Level 1 (Low)
              </button>
              <button
                type="button"
                onClick={() => toggleLevel(2)}
                className={`px-2.5 py-1 rounded-lg font-extrabold text-[11px] border cursor-pointer transition-all ${
                  activeLevels[2] ? 'bg-sky-50 text-sky-800 border-sky-300' : 'bg-white text-slate-400 border-slate-200'
                }`}
              >
                Level 2 (Normal)
              </button>
              <button
                type="button"
                onClick={() => toggleLevel(3)}
                className={`px-2.5 py-1 rounded-lg font-extrabold text-[11px] border cursor-pointer transition-all ${
                  activeLevels[3] ? 'bg-purple-50 text-purple-800 border-purple-300' : 'bg-white text-slate-400 border-slate-200'
                }`}
              >
                Level 3 (High)
              </button>
            </div>
          </div>

          {/* 3 Level Stats Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Level 1 Stats Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                  Level 1 (Low)
                </span>
                <span className="text-[10px] font-bold text-slate-400">N = {level1Stats.n}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center py-1">
                <div>
                  <span className="text-[10px] text-slate-400 block">Mean</span>
                  <span className="text-sm font-extrabold text-slate-900">{level1Stats.mean}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">S.D.</span>
                  <span className="text-sm font-extrabold text-slate-900">{level1Stats.sd}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">C.V.%</span>
                  <span className={`text-sm font-extrabold ${level1Stats.cv > 10 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {level1Stats.cv}%
                  </span>
                </div>
              </div>
              <div className="text-[10px] pt-1.5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-slate-400">หลุดเกณฑ์ 3SD:</span>
                {level1Stats.outOfControlCount > 0 ? (
                  <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded">
                    {level1Stats.outOfControlCount} ครั้ง
                  </span>
                ) : (
                  <span className="text-emerald-600 font-bold">0 ครั้ง (ปกติ)</span>
                )}
              </div>
            </div>

            {/* Level 2 Stats Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-sky-800 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-md">
                  Level 2 (Normal)
                </span>
                <span className="text-[10px] font-bold text-slate-400">N = {level2Stats.n}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center py-1">
                <div>
                  <span className="text-[10px] text-slate-400 block">Mean</span>
                  <span className="text-sm font-extrabold text-slate-900">{level2Stats.mean}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">S.D.</span>
                  <span className="text-sm font-extrabold text-slate-900">{level2Stats.sd}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">C.V.%</span>
                  <span className={`text-sm font-extrabold ${level2Stats.cv > 8 ? 'text-rose-600' : 'text-sky-600'}`}>
                    {level2Stats.cv}%
                  </span>
                </div>
              </div>
              <div className="text-[10px] pt-1.5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-slate-400">หลุดเกณฑ์ 3SD:</span>
                {level2Stats.outOfControlCount > 0 ? (
                  <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded">
                    {level2Stats.outOfControlCount} ครั้ง
                  </span>
                ) : (
                  <span className="text-emerald-600 font-bold">0 ครั้ง (ปกติ)</span>
                )}
              </div>
            </div>

            {/* Level 3 Stats Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-md">
                  Level 3 (High)
                </span>
                <span className="text-[10px] font-bold text-slate-400">N = {level3Stats.n}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center py-1">
                <div>
                  <span className="text-[10px] text-slate-400 block">Mean</span>
                  <span className="text-sm font-extrabold text-slate-900">{level3Stats.mean}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">S.D.</span>
                  <span className="text-sm font-extrabold text-slate-900">{level3Stats.sd}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">C.V.%</span>
                  <span className={`text-sm font-extrabold ${level3Stats.cv > 8 ? 'text-rose-600' : 'text-purple-600'}`}>
                    {level3Stats.cv}%
                  </span>
                </div>
              </div>
              <div className="text-[10px] pt-1.5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-slate-400">หลุดเกณฑ์ 3SD:</span>
                {level3Stats.outOfControlCount > 0 ? (
                  <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded">
                    {level3Stats.outOfControlCount} ครั้ง
                  </span>
                ) : (
                  <span className="text-emerald-600 font-bold">0 ครั้ง (ปกติ)</span>
                )}
              </div>
            </div>

          </div>

          {/* SVG Levey-Jennings Plot */}
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
              return (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-400">ไม่พบข้อมูล LOT {filterLot} ในระบบ</p>
                </div>
              );
            }

            const levelDefs = [
              { level: 1, key: 'L1', label: 'Level 1 (Low)', dataKey: 'level1' as const, color: '#10b981', stats: level1Stats, target: currentLotConfig.level1Target, sd: currentLotConfig.level1SD },
              { level: 2, key: 'L2', label: 'Level 2 (Normal)', dataKey: 'level2' as const, color: '#0284c7', stats: level2Stats, target: currentLotConfig.level2Target, sd: currentLotConfig.level2SD },
              { level: 3, key: 'L3', label: 'Level 3 (High)', dataKey: 'level3' as const, color: '#9333ea', stats: level3Stats, target: currentLotConfig.level3Target, sd: currentLotConfig.level3SD },
            ];

            const activeDefs = levelDefs.filter(d => activeLevels[d.level]);

            if (filteredChartRecords.length === 0) {
              return (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                  <BarChart3 size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-600">ไม่มีข้อมูลบันทึก QC ของ LOT {filterLot} ตามตัวกรองที่ระบุ</p>
                  <p className="text-[11px] text-slate-400 mt-1">กรุณาลงผลตรวจ QC ที่แท็บ "ลงผลตรวจด่วน" หรือเปลี่ยนตัวกรอง</p>
                </div>
              );
            }

            // Calculate SVG bounding box ranges
            let rangeMin = Infinity;
            let rangeMax = -Infinity;

            activeDefs.forEach(d => {
              const target = d.stats.mean || d.target;
              const sd = d.stats.sd || d.sd || 1;
              const minVal = target - 3.5 * sd;
              const maxVal = target + 3.5 * sd;
              if (minVal < rangeMin) rangeMin = minVal;
              if (maxVal > rangeMax) rangeMax = maxVal;
            });

            if (!isFinite(rangeMin) || !isFinite(rangeMax) || rangeMin === rangeMax) {
              rangeMin = 0;
              rangeMax = 400;
            }

            const width = 860;
            const height = 360;
            const paddingLeft = 70;
            const paddingRight = 60;
            const paddingTop = 30;
            const paddingBottom = 45;

            const plotWidth = width - paddingLeft - paddingRight;
            const plotHeight = height - paddingTop - paddingBottom;

            const getX = (idx: number) => {
              if (filteredChartRecords.length <= 1) return paddingLeft + plotWidth / 2;
              return paddingLeft + (idx / (filteredChartRecords.length - 1)) * plotWidth;
            };

            const getY = (val: number) => {
              const fraction = (val - rangeMin) / (rangeMax - rangeMin);
              return paddingTop + plotHeight - fraction * plotHeight;
            };

            return (
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-4 relative">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-extrabold text-slate-800">
                      กราฟควบคุมคุณภาพ Levey-Jennings Plot (LOT {filterLot})
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      แสดงจุดข้อมูล {filteredChartRecords.length} จุด พร้อมเส้น Mean และเกณฑ์ Standard Deviation (SD)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeDefs.map(d => (
                      <span key={d.level} className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
                        <span className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: d.color }} />
                        {d.label} (Mean: {Math.round(d.stats.mean)})
                      </span>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <svg className="w-full min-w-[760px] h-88" viewBox={`0 0 ${width} ${height}`}>
                    {/* Plot Background */}
                    <rect x={paddingLeft} y={paddingTop} width={plotWidth} height={plotHeight} fill="#f8fafc" rx="8" />

                    {/* Single or Multi-level Target & SD Lines */}
                    {activeDefs.map(d => {
                      const target = d.stats.mean || d.target;
                      const sd = d.stats.sd || d.sd || 1;

                      if (activeDefs.length === 1) {
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
                          <g key={`grid-${d.level}`}>
                            {/* Translucent Zone Highlights */}
                            <rect x={paddingLeft} y={getY(target + 2 * sd)} width={plotWidth} height={Math.max(0, getY(target - 2 * sd) - getY(target + 2 * sd))} fill="#10b981" fillOpacity="0.04" />
                            <rect x={paddingLeft} y={getY(target + 3 * sd)} width={plotWidth} height={Math.max(0, getY(target + 2 * sd) - getY(target + 3 * sd))} fill="#f59e0b" fillOpacity="0.07" />
                            <rect x={paddingLeft} y={getY(target - 2 * sd)} width={plotWidth} height={Math.max(0, getY(target - 3 * sd) - getY(target - 2 * sd))} fill="#f59e0b" fillOpacity="0.07" />

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
                                  y={getY(line.val) + 3.5}
                                  textAnchor="end"
                                  fill={line.color}
                                  className="font-mono text-[9px] font-extrabold"
                                >
                                  {Math.round(line.val)}
                                </text>
                                <text
                                  x={width - paddingRight + 6}
                                  y={getY(line.val) + 3.5}
                                  textAnchor="start"
                                  fill={line.color}
                                  className="font-bold text-[8px]"
                                >
                                  {line.label}
                                </text>
                              </g>
                            ))}
                          </g>
                        );
                      } else {
                        // Multi-level simplified mean lines
                        return (
                          <g key={`grid-multi-${d.level}`}>
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
                              y={getY(target) + 3.5}
                              textAnchor="end"
                              fill={d.color}
                              className="font-mono text-[9px] font-extrabold"
                            >
                              {Math.round(target)}
                            </text>
                            <text
                              x={width - paddingRight + 6}
                              y={getY(target) + 3.5}
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

                    {/* Timeline Paths */}
                    {activeDefs.map(d => {
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
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      );
                    })}

                    {/* Data Points */}
                    {activeDefs.map(d => {
                      return filteredChartRecords.map((rec, idx) => {
                        const val = rec[d.dataKey];
                        const x = getX(idx);
                        const y = getY(val);
                        const status = d.level === 1 ? rec.level1Status : d.level === 2 ? rec.level2Status : rec.level3Status;
                        const isOut = status === 'out_of_control';

                        return (
                          <circle
                            key={`point-${d.level}-${idx}`}
                            cx={x}
                            cy={y}
                            r={isOut ? 5.5 : 4}
                            fill={isOut ? '#ef4444' : d.color}
                            stroke="#ffffff"
                            strokeWidth={1.5}
                            className="cursor-pointer hover:scale-150 transition-all"
                            onMouseEnter={() => {
                              setHoveredPoint({
                                date: rec.date,
                                ward: rec.ward,
                                serial: rec.serialNumber,
                                operator: rec.operator,
                                level: d.level,
                                val,
                                target: Math.round(d.stats.mean),
                                sd: d.stats.sd,
                                status: isOut ? 'Out of control (หลุดเกณฑ์)' : 'In control (ปกติ)',
                                x,
                                y
                              });
                            }}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                        );
                      });
                    })}

                    {/* X-Axis Date Labels */}
                    {filteredChartRecords.map((rec, idx) => {
                      if (filteredChartRecords.length > 15 && idx % Math.ceil(filteredChartRecords.length / 10) !== 0) {
                        return null;
                      }
                      const x = getX(idx);
                      const shortDate = rec.date.substring(5);
                      return (
                        <text
                          key={`xlabel-${idx}`}
                          x={x}
                          y={height - paddingBottom + 16}
                          textAnchor="middle"
                          fill="#64748b"
                          className="font-mono text-[9px] font-semibold"
                        >
                          {shortDate}
                        </text>
                      );
                    })}
                  </svg>
                </div>

                {/* Floating Interactive Tooltip */}
                {hoveredPoint && (
                  <div className="absolute bottom-4 right-4 bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 z-30 border border-slate-700 animate-fade-in">
                    <div className="font-extrabold flex items-center justify-between gap-4 border-b border-slate-700 pb-1">
                      <span>Level {hoveredPoint.level} ({hoveredPoint.val} mg/dL)</span>
                      <span className={hoveredPoint.status.includes('หลุด') ? 'text-rose-400' : 'text-emerald-400'}>
                        {hoveredPoint.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 space-y-0.5 pt-0.5">
                      <div>เครื่อง: <strong>{hoveredPoint.serial}</strong> ({hoveredPoint.ward})</div>
                      <div>วันที่: <strong>{hoveredPoint.date}</strong> | ผู้ตรวจ: <strong>{hoveredPoint.operator}</strong></div>
                      <div>ค่าเป้าหมาย: <strong>{hoveredPoint.target}</strong> (Diff: {hoveredPoint.val - hoveredPoint.target > 0 ? `+${hoveredPoint.val - hoveredPoint.target}` : hoveredPoint.val - hoveredPoint.target})</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

            </div>
          )}

          {/* Table Filters & Actions */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              
              {/* Filter Ward */}
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 font-medium">หน่วยงาน:</span>
                <CustomSelect
                  value={filterWard}
                  onChange={(e) => {
                    setFilterWard(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 font-semibold min-w-[150px]"
                >
                  <option value="">-- ทุกหน่วยงาน --</option>
                  {wards.map((w, idx) => (
                    <option key={idx} value={w.thai_name}>{w.thai_name}</option>
                  ))}
                </CustomSelect>
              </div>

              {/* Filter Lot */}
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 font-medium">LOT:</span>
                <CustomSelect
                  value={filterLot}
                  onChange={(e) => {
                    setFilterLot(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 font-semibold min-w-[120px]"
                >
                  <option value="">-- ทุก LOT --</option>
                  {lotConfigs.map((c, idx) => (
                    <option key={idx} value={c.lotNumber}>{c.lotNumber}</option>
                  ))}
                </CustomSelect>
              </div>

              {/* Filter Month */}
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 font-medium">เดือน:</span>
                <CustomSelect
                  value={filterMonth}
                  onChange={(e) => {
                    setFilterMonth(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 font-semibold min-w-[120px]"
                >
                  <option value="">-- ทุกเดือน --</option>
                  {availableMonths.map((m, idx) => (
                    <option key={idx} value={m}>{m}</option>
                  ))}
                </CustomSelect>
              </div>

              {/* Filter Status */}
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 font-medium">สถานะ:</span>
                <CustomSelect
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 font-semibold min-w-[130px]"
                >
                  <option value="all">ทั้งหมด</option>
                  <option value="normal">เฉพาะ In Control</option>
                  <option value="out_of_control">เฉพาะ Out of Control</option>
                </CustomSelect>
              </div>

            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <Download size={14} />
              <span>ส่งออก CSV ({tableRecords.length} แถว)</span>
            </button>
          </div>

          {/* Records Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/90 text-slate-500 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="py-3 px-3.5">วันที่ตรวจ</th>
                    <th className="py-3 px-3.5">หน่วยงาน (Ward)</th>
                    <th className="py-3 px-3.5">รหัสเครื่อง DTX</th>
                    <th className="py-3 px-3.5">LOT น้ำยา</th>
                    <th className="py-3 px-3.5 text-center">Level 1 (Low)</th>
                    <th className="py-3 px-3.5 text-center">Level 2 (Normal)</th>
                    <th className="py-3 px-3.5 text-center">Level 3 (High)</th>
                    <th className="py-3 px-3.5 text-center">สถานะรวม</th>
                    <th className="py-3 px-3.5">ผู้ลงบันทึก</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {paginatedQC.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400">
                        ไม่พบข้อมูลบันทึกผล QC ตามเงื่อนไขที่เลือก
                      </td>
                    </tr>
                  ) : (
                    paginatedQC.map((rec) => {
                      const isOut = rec.level1Status === 'out_of_control' || rec.level2Status === 'out_of_control' || rec.level3Status === 'out_of_control';
                      return (
                        <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3.5 font-bold text-slate-700 whitespace-nowrap">{rec.date}</td>
                          <td className="py-3 px-3.5 text-slate-900 font-bold">{rec.ward}</td>
                          <td className="py-3 px-3.5 text-sky-800 font-bold font-mono">{rec.serialNumber}</td>
                          <td className="py-3 px-3.5 text-slate-600 font-mono text-[11px]">
                            <span className="font-bold">{rec.lotNumber}</span>
                            {(() => {
                              const lotCfg = lotConfigs.find(c => c.lotNumber === rec.lotNumber);
                              const exp = calculateLotExpInfo(lotCfg);
                              if (exp.status === 'expired') {
                                return (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-1 py-0.2 rounded mt-0.5">
                                    ⛔ หมดอายุ
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </td>
                          
                          {/* Level 1 */}
                          <td className="py-3 px-3.5 text-center">
                            <span className={`inline-block font-extrabold px-2 py-0.5 rounded ${
                              rec.level1Status === 'out_of_control' ? 'bg-rose-100 text-rose-700' : 'text-emerald-700'
                            }`}>
                              {rec.level1}
                            </span>
                          </td>

                          {/* Level 2 */}
                          <td className="py-3 px-3.5 text-center">
                            <span className={`inline-block font-extrabold px-2 py-0.5 rounded ${
                              rec.level2Status === 'out_of_control' ? 'bg-rose-100 text-rose-700' : 'text-sky-700'
                            }`}>
                              {rec.level2}
                            </span>
                          </td>

                          {/* Level 3 */}
                          <td className="py-3 px-3.5 text-center">
                            <span className={`inline-block font-extrabold px-2 py-0.5 rounded ${
                              rec.level3Status === 'out_of_control' ? 'bg-rose-100 text-rose-700' : 'text-purple-700'
                            }`}>
                              {rec.level3}
                            </span>
                          </td>

                          {/* Total Status */}
                          <td className="py-3 px-3.5 text-center">
                            {isOut ? (
                              <span className="inline-flex items-center text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                ✕ Out of control
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                ✓ In control
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3.5 text-slate-600 text-[11px] whitespace-nowrap">{rec.operator}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  แสดง {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, tableRecords.length)} จากทั้งหมด {tableRecords.length} แถว
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-3 font-bold text-slate-700">{currentPage} / {totalPages}</span>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* VIEW 4: LOT & TARGET RANGE CONFIGURATION (DERIVED FROM REAGENT STRIP STOCK) */}
      {activeTab === 'config' && (
        <div className="space-y-5" id="qc-config-view">
          {/* Top Header Card */}
          <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-800 flex items-center gap-2">
                  <PackageCheck size={18} className="text-sky-600" />
                  <span>Setting Range by LOT (ตั้งค่าช่วงค่ามาตรฐานตาม LOT แถบตรวจในคลัง)</span>
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                  {stockLots.length} LOTs ในคลังพัสดุ
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {unifiedLotList.filter(l => l.isConfigured).length} ตั้งค่าแล้ว
                </span>
                {unifiedLotList.filter(l => !l.isConfigured).length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                    {unifiedLotList.filter(l => !l.isConfigured).length} รอกำหนดช่วงค่า
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                นำข้อมูล LOT จากกล่องแถบตรวจในคลังพัสดุ (Reagent Strip Stock) มากำหนดค่า Target, S.D., และ Min/Max (mg/dL) เพื่อใช้ประเมินผล IQC ประจำวัน
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={loadStockItems}
                disabled={isLoadingStock}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-all"
                title="รีเฟรชข้อมูล LOT จากคลังพัสดุ"
              >
                <RefreshCw size={13} className={isLoadingStock ? 'animate-spin' : ''} />
                <span>รีเฟรชสต็อก</span>
              </button>

              {role === 'admin' && (
                <button
                  type="button"
                  onClick={handleOpenAddLotModal}
                  className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs transition-all"
                >
                  <Plus size={15} />
                  <span>เลือก LOT จากคลังเพื่อตั้งค่า Target</span>
                </button>
              )}
            </div>
          </div>

          {/* Pending Stock LOTs Notice Banner */}
          {unifiedLotList.filter(l => !l.isConfigured).length > 0 && (
            <div className="bg-amber-50/80 border border-amber-200/90 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start space-x-2.5">
                <AlertTriangle size={17} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-amber-900">
                    พบ {unifiedLotList.filter(l => !l.isConfigured).length} รายการ LOT ในคลังพัสดุที่ยังไม่ได้ตั้งค่า Target Range
                  </h4>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    มีแถบตรวจที่รับเข้าคลังแล้วแต่ยังไม่ได้กำหนดค่ามาตรฐานข้างกล่อง L1, L2, L3 — กรุณากดปุ่มเพื่อตั้งค่าก่อนนำไปตรวจ QC
                  </p>
                </div>
              </div>
              {role === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    const firstUnconfigured = unifiedLotList.find(l => !l.isConfigured);
                    if (firstUnconfigured) {
                      handleStartConfigureStockLot(firstUnconfigured.lotNumber);
                    }
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3.5 py-1.5 rounded-xl shrink-0 cursor-pointer shadow-2xs"
                >
                  ⚙️ ตั้งค่า LOT แรกที่รอดำเนินการ
                </button>
              )}
            </div>
          )}

          {/* Empty State when no lots found */}
          {unifiedLotList.length === 0 && (
            <div className="bg-white p-12 rounded-2xl border border-slate-200/90 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Package size={24} />
              </div>
              <h4 className="text-sm font-bold text-slate-800">ยังไม่พบข้อมูล LOT ในคลังพัสดุ</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                หน้านี้จะดึง LOT จาก "คลังแถบตรวจและน้ำยา (Reagent Strip Stock)" โดยอัตโนมัติ กรุณารับเข้าแถบตรวจที่เมนูคลังพัสดุก่อนเพื่อนำมาตั้งค่า Target Range
              </p>
            </div>
          )}

          {/* Grid of LOT Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unifiedLotList.map((item, idx) => {
              const cfg = item.config;
              const expInfo = cfg ? calculateLotExpInfo(cfg) : {
                lotNumber: item.lotNumber,
                status: 'valid' as const,
                statusText: item.expDate ? `หมดอายุ: ${item.expDate}` : 'ยังไม่ระบุวันหมดอายุ',
                colorClass: 'text-slate-700',
                badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
                effectiveExpDate: item.expDate
              };

              return (
                <div 
                  key={idx} 
                  className={`bg-white p-5 rounded-2xl border shadow-sm space-y-4 flex flex-col justify-between transition-all ${
                    item.isConfigured 
                      ? 'border-slate-200/90' 
                      : 'border-amber-300 ring-1 ring-amber-200 bg-amber-50/20'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header & Badges */}
                    <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {item.itemType === 'control_solution' ? 'Control Solution' : 'Test Strip LOT'}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                            {item.manufacturer || 'VivaChek Fad'}
                          </span>
                          {item.isConfigured ? (
                            <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                              ✓ ตั้งค่าแล้ว
                            </span>
                          ) : (
                            <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded animate-pulse">
                              ⏳ รอตั้งค่า Target
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-black text-slate-900 font-mono">{item.lotNumber}</h4>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {role === 'admin' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartConfigureStockLot(item.lotNumber)}
                              className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                item.isConfigured
                                  ? 'text-sky-600 hover:text-sky-800 bg-sky-50 hover:bg-sky-100'
                                  : 'text-white bg-amber-600 hover:bg-amber-700'
                              }`}
                            >
                              {item.isConfigured ? 'แก้ไข' : 'ตั้งค่า'}
                            </button>
                            {item.isConfigured && (
                              <button
                                type="button"
                                onClick={() => handleDeleteLotConfig(item.lotNumber)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title={`ลบการตั้งค่ามาตรฐาน LOT ${item.lotNumber}`}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Stock & Expiration Info Box */}
                    <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/70 space-y-2 text-xs">
                      {/* Stock quantity if available */}
                      {item.stockInfo ? (
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 pb-1.5 border-b border-slate-200/60">
                          <span className="flex items-center gap-1 text-slate-600">
                            <Package size={13} className="text-amber-600" />
                            <span>พัสดุในคลัง (Stock):</span>
                          </span>
                          <span className="text-slate-800">
                            {item.stockInfo.totalBoxes} กล่อง ({item.stockInfo.inStockCount} พร้อมใช้, {item.stockInfo.inUseCount} กำลังใช้)
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pb-1.5 border-b border-slate-200/60">
                          <span>แหล่งข้อมูล:</span>
                          <span className="font-semibold text-slate-700">บันทึกเป้าหมาย QC</span>
                        </div>
                      )}

                      {/* Expiration Details */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-0.5">
                        <div>
                          <span className="text-slate-400 block text-[10px]">วันหมดอายุฉลาก (EXP)</span>
                          <strong className="text-slate-800 font-mono">{item.expDate || '-'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">วันเปิดขวด (อายุ {cfg?.openExpDays || 90} วัน)</span>
                          <strong className="text-slate-800 font-mono">{cfg?.openDate || 'ยังไม่เปิด'}</strong>
                        </div>
                      </div>

                      {expInfo.effectiveExpDate && (
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">วันหมดอายุใช้งานจริง:</span>
                          <strong className={`font-black font-mono ${expInfo.colorClass}`}>{expInfo.effectiveExpDate}</strong>
                        </div>
                      )}

                      {cfg?.notes && (
                        <p className="text-[10px] text-slate-500 italic bg-white/60 p-1.5 rounded border border-slate-100">
                          {cfg.notes}
                        </p>
                      )}
                    </div>

                    {/* Target Ranges or Unconfigured Prompt */}
                    {item.isConfigured && cfg ? (
                      <div className="space-y-1.5 text-xs">
                        {/* Level 1 */}
                        <div className="p-2 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-center justify-between text-[11px]">
                          <span className="font-extrabold text-emerald-900">L1 (Low)</span>
                          <div className="space-x-2 text-slate-600 font-mono">
                            <span>Target: <strong>{cfg.level1Target}</strong> (SD {cfg.level1SD})</span>
                            <span>Range: <strong>{cfg.level1Min}-{cfg.level1Max}</strong></span>
                          </div>
                        </div>

                        {/* Level 2 */}
                        <div className="p-2 bg-sky-50/50 rounded-xl border border-sky-100 flex items-center justify-between text-[11px]">
                          <span className="font-extrabold text-sky-900">L2 (Normal)</span>
                          <div className="space-x-2 text-slate-600 font-mono">
                            <span>Target: <strong>{cfg.level2Target}</strong> (SD {cfg.level2SD})</span>
                            <span>Range: <strong>{cfg.level2Min}-{cfg.level2Max}</strong></span>
                          </div>
                        </div>

                        {/* Level 3 */}
                        <div className="p-2 bg-purple-50/50 rounded-xl border border-purple-100 flex items-center justify-between text-[11px]">
                          <span className="font-extrabold text-purple-900">L3 (High)</span>
                          <div className="space-x-2 text-slate-600 font-mono">
                            <span>Target: <strong>{cfg.level3Target}</strong> (SD {cfg.level3SD})</span>
                            <span>Range: <strong>{cfg.level3Min}-{cfg.level3Max}</strong></span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center space-y-2">
                        <p className="text-[11px] text-amber-800 font-bold">
                          ยังไม่ได้กำหนด Target Ranges (L1, L2, L3) ข้างกล่อง
                        </p>
                        {role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleStartConfigureStockLot(item.lotNumber)}
                            className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                          >
                            <Plus size={14} />
                            <span>ตั้งค่าช่วงค่ามาตรฐานสำหรับ LOT นี้</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Edit / Configure Lot Modal */}
          {editingLotIdx !== null && editedLot && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-100 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {`ตั้งค่าเป้าหมาย Target Range สำหรับ LOT ${editedLot.lotNumber || '(เลือกจากคลัง)'}`}
                    </h3>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 font-bold mt-0.5">
                      📌 หมายเหตุ: ช่วงเป้าหมาย QC (Target Range L1, L2, L3) ถูกกำหนดอยู่บน [ข้างกล่องแผ่นตรวจ Strip Box] ไม่ใช่น้ำยาควบคุม
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLotIdx(null);
                      setEditedLot(null);
                    }}
                    className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer"
                  >
                    ✕ ปิด
                  </button>
                </div>

                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                  
                  {/* Manufacturer Brand Badge */}
                  <div className="flex items-center justify-between bg-sky-50/80 px-3 py-2 rounded-xl border border-sky-200">
                    <span className="text-[11px] font-bold text-sky-900 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-sky-600" />
                      <span>ยี่ห้อเครื่องตรวจ/พัสดุ DTX:</span>
                    </span>
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-lg bg-sky-600 text-white shadow-2xs">
                      {editedLot.manufacturer || 'VivaChek Fad'}
                    </span>
                  </div>

                  {/* LOT Source from Reagent Strip Stock */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                    {/* Pull from Stock Dropdown */}
                    {stockLots.length > 0 && (
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200/90 space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <Package size={13} className="text-amber-600" />
                          <span>เลือกล็อตจากคลังพัสดุ (Reagent Strip Stock):</span>
                        </label>
                        <select
                          className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 outline-none cursor-pointer focus:ring-2 focus:ring-sky-500"
                          value={editedLot.lotNumber}
                          onChange={(e) => {
                            const selectedVal = e.target.value;
                            const matchedStock = stockLots.find(s => s.lotNumber === selectedVal);
                            const matchedConfig = lotConfigs.find(l => l.lotNumber === selectedVal);
                            
                            if (matchedConfig) {
                              setEditedLot({
                                ...matchedConfig,
                                lotNumber: selectedVal,
                                manufacturer: matchedStock?.manufacturer || matchedConfig.manufacturer || 'VivaChek Fad',
                                expDate: matchedStock?.expDate || matchedConfig.expDate || editedLot.expDate,
                                receivedDate: matchedStock?.receivedDate || matchedConfig.receivedDate || editedLot.receivedDate
                              });
                            } else if (matchedStock) {
                              setEditedLot({
                                ...editedLot,
                                lotNumber: matchedStock.lotNumber,
                                manufacturer: matchedStock.manufacturer || 'VivaChek Fad',
                                expDate: matchedStock.expDate || editedLot.expDate,
                                receivedDate: matchedStock.receivedDate || editedLot.receivedDate
                              });
                            }
                          }}
                        >
                          <option value="" disabled>-- เลือก LOT จากคลังพัสดุ --</option>
                          {stockLots.map((sl, i) => {
                            const isConfigured = lotConfigs.some(lc => lc.lotNumber === sl.lotNumber);
                            return (
                              <option key={i} value={sl.lotNumber}>
                                {sl.lotNumber} ({sl.itemType === 'control_solution' ? 'น้ำยา QC' : 'Strip'}) {sl.expDate ? `• EXP: ${sl.expDate}` : ''} {isConfigured ? '✓ (ตั้งค่าแล้ว)' : '⏳ (ยังไม่ตั้งค่า)'}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-800 block mb-1">
                          เลข LOT Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editedLot.lotNumber}
                          onChange={(e) => setEditedLot({ ...editedLot, lotNumber: e.target.value })}
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-mono font-bold focus:ring-2 focus:ring-sky-500 outline-none"
                          placeholder="เช่น LOT2026-A"
                          required
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          (อ้างอิงจาก Reagent Strip Stock ในคลัง)
                        </span>
                      </div>
                      <div>
                        <label className="font-bold text-slate-800 block mb-1">
                          วันหมดอายุตามฉลาก (Exp Date) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={editedLot.expDate || ''}
                          onChange={(e) => setEditedLot({ ...editedLot, expDate: e.target.value })}
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-bold focus:ring-2 focus:ring-sky-500 outline-none font-mono"
                          required
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          (ระบุวันหมดอายุตามที่พิมพ์ข้างกล่อง)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Target Range Form Header with Auto Calc buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <div>
                      <span className="font-extrabold text-slate-900 text-xs flex items-center space-x-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                        <span>กำหนดช่วงค่ามาตรฐาน QC (Target Ranges ข้างกล่อง)</span>
                      </span>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        💡 กรอก Min & Max ข้างกล่อง ระบบจะคำนวณค่า Mean (Target) และ S.D. ให้อัตโนมัติทันที
                      </p>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={handleAutoCalcAllLevels}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center space-x-1 cursor-pointer transition-all shadow-xs"
                        title="คำนวณ Target (Mean) และ S.D. จากช่วง Min/Max ข้างกล่อง"
                      >
                        <Sparkles size={12} />
                        <span>คำนวณ Target & SD จาก Min/Max</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditedLot({
                            ...editedLot,
                            level1Min: Math.max(0, Math.round(((editedLot.level1Target || 0) - 2 * (editedLot.level1SD || 0)) * 10) / 10),
                            level1Max: Math.round(((editedLot.level1Target || 0) + 2 * (editedLot.level1SD || 0)) * 10) / 10,
                            level2Min: Math.max(0, Math.round(((editedLot.level2Target || 0) - 2 * (editedLot.level2SD || 0)) * 10) / 10),
                            level2Max: Math.round(((editedLot.level2Target || 0) + 2 * (editedLot.level2SD || 0)) * 10) / 10,
                            level3Min: Math.max(0, Math.round(((editedLot.level3Target || 0) - 2 * (editedLot.level3SD || 0)) * 10) / 10),
                            level3Max: Math.round(((editedLot.level3Target || 0) + 2 * (editedLot.level3SD || 0)) * 10) / 10,
                          });
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 text-[11px] font-bold flex items-center space-x-1 cursor-pointer transition-all"
                        title="คำนวณ Min/Max จาก Target ± 2SD"
                      >
                        <Calculator size={12} />
                        <span>Target ± 2SD</span>
                      </button>
                    </div>
                  </div>

                  {/* Level 1 Inputs */}
                  <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-emerald-900 block text-xs">Level 1 (Low Range)</span>
                      <span className="text-[10px] text-emerald-700 font-medium">กรอก Min & Max ข้างกล่อง เพื่อคำนวณ Target/Mean และ SD</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-700 font-bold block mb-0.5">
                          Min ข้างกล่อง <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          placeholder="เช่น 35"
                          value={editedLot.level1Min || ''}
                          onChange={(e) => updateLevelValues(1, 'min', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full text-xs p-2 rounded-lg border border-emerald-300 bg-white text-center font-bold text-emerald-700 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-700 font-bold block mb-0.5">
                          Max ข้างกล่อง <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          placeholder="เช่น 55"
                          value={editedLot.level1Max || ''}
                          onChange={(e) => updateLevelValues(1, 'max', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full text-xs p-2 rounded-lg border border-emerald-300 bg-white text-center font-bold text-emerald-700 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-600 font-bold block mb-0.5 flex items-center justify-center gap-1">
                          <span>Target (Mean)</span>
                          <span className="text-[9px] px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded font-semibold">Auto</span>
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="เช่น 45"
                          value={editedLot.level1Target || ''}
                          onChange={(e) => updateLevelValues(1, 'target', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-emerald-50/40 text-center font-bold font-mono focus:ring-2 focus:ring-sky-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-600 font-bold block mb-0.5 flex items-center justify-center gap-1">
                          <span>S.D.</span>
                          <span className="text-[9px] px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded font-semibold">Auto</span>
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="เช่น 5.0"
                          value={editedLot.level1SD || ''}
                          onChange={(e) => updateLevelValues(1, 'sd', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-emerald-50/40 text-center font-bold font-mono focus:ring-2 focus:ring-sky-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Level 2 Inputs */}
                  <div className="p-3.5 bg-sky-50/70 rounded-xl border border-sky-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sky-900 block text-xs">Level 2 (Normal Range)</span>
                      <span className="text-[10px] text-sky-700 font-medium">กรอก Min & Max ข้างกล่อง เพื่อคำนวณ Target/Mean และ SD</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-700 font-bold block mb-0.5">
                          Min ข้างกล่อง <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          placeholder="เช่น 100"
                          value={editedLot.level2Min || ''}
                          onChange={(e) => updateLevelValues(2, 'min', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full text-xs p-2 rounded-lg border border-sky-300 bg-white text-center font-bold text-sky-700 font-mono focus:ring-2 focus:ring-sky-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-700 font-bold block mb-0.5">
                          Max ข้างกล่อง <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          placeholder="เช่น 140"
                          value={editedLot.level2Max || ''}
                          onChange={(e) => updateLevelValues(2, 'max', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full text-xs p-2 rounded-lg border border-sky-300 bg-white text-center font-bold text-sky-700 font-mono focus:ring-2 focus:ring-sky-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-600 font-bold block mb-0.5 flex items-center justify-center gap-1">
                          <span>Target (Mean)</span>
                          <span className="text-[9px] px-1 py-0.2 bg-sky-100 text-sky-800 rounded font-semibold">Auto</span>
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="เช่น 120"
                          value={editedLot.level2Target || ''}
                          onChange={(e) => updateLevelValues(2, 'target', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-sky-50/40 text-center font-bold font-mono focus:ring-2 focus:ring-sky-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-600 font-bold block mb-0.5 flex items-center justify-center gap-1">
                          <span>S.D.</span>
                          <span className="text-[9px] px-1 py-0.2 bg-sky-100 text-sky-800 rounded font-semibold">Auto</span>
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="เช่น 10.0"
                          value={editedLot.level2SD || ''}
                          onChange={(e) => updateLevelValues(2, 'sd', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-sky-50/40 text-center font-bold font-mono focus:ring-2 focus:ring-sky-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Level 3 Inputs */}
                  <div className="p-3.5 bg-purple-50/70 rounded-xl border border-purple-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-purple-900 block text-xs">Level 3 (High Range)</span>
                      <span className="text-[10px] text-purple-700 font-medium">กรอก Min & Max ข้างกล่อง เพื่อคำนวณ Target/Mean และ SD</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-700 font-bold block mb-0.5">
                          Min ข้างกล่อง <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          placeholder="เช่น 260"
                          value={editedLot.level3Min || ''}
                          onChange={(e) => updateLevelValues(3, 'min', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full text-xs p-2 rounded-lg border border-purple-300 bg-white text-center font-bold text-purple-700 font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-700 font-bold block mb-0.5">
                          Max ข้างกล่อง <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          placeholder="เช่น 340"
                          value={editedLot.level3Max || ''}
                          onChange={(e) => updateLevelValues(3, 'max', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full text-xs p-2 rounded-lg border border-purple-300 bg-white text-center font-bold text-purple-700 font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-600 font-bold block mb-0.5 flex items-center justify-center gap-1">
                          <span>Target (Mean)</span>
                          <span className="text-[9px] px-1 py-0.2 bg-purple-100 text-purple-800 rounded font-semibold">Auto</span>
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="เช่น 300"
                          value={editedLot.level3Target || ''}
                          onChange={(e) => updateLevelValues(3, 'target', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-purple-50/40 text-center font-bold font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-600 font-bold block mb-0.5 flex items-center justify-center gap-1">
                          <span>S.D.</span>
                          <span className="text-[9px] px-1 py-0.2 bg-purple-100 text-purple-800 rounded font-semibold">Auto</span>
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="เช่น 20.0"
                          value={editedLot.level3SD || ''}
                          onChange={(e) => updateLevelValues(3, 'sd', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-purple-50/40 text-center font-bold font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  {role === 'admin' && editedLot.lotNumber && editedLot.lotNumber.trim().length > 0 ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteLotConfig(editedLot.lotNumber)}
                      className="px-3.5 py-2 rounded-xl text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                      <span>ลบการตั้งค่า LOT นี้</span>
                    </button>
                  ) : (
                    <div></div>
                  )}

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLotIdx(null);
                        setEditedLot(null);
                      }}
                      className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 font-bold cursor-pointer hover:bg-slate-200"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveLotConfig}
                      className="px-4 py-2 rounded-xl text-white bg-sky-600 hover:bg-sky-500 font-bold cursor-pointer shadow-xs"
                    >
                      บันทึกการตั้งค่า Target Range
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Alert when performing QC with EXPIRED control */}
      {showExpiredPromptDialog && pendingExpiredRecord && pendingExpiredLotInfo && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-rose-200 text-xs">
            
            {/* Header */}
            <div className="flex items-start space-x-3.5 border-b border-slate-100 pb-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
                <AlertOctagon size={24} className="animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                  Critical Warning
                </span>
                <h3 className="text-base font-black text-slate-900">
                  ตรวจพบการทำ QC ด้วยน้ำยาที่หมดอายุ!
                </h3>
                <p className="text-[11px] text-slate-500">
                  น้ำยา Control LOT นี้หมดอายุการใช้งานแล้ว ผลการตรวจอาจคลาดเคลื่อน
                </p>
              </div>
            </div>

            {/* Expired Lot Details Box */}
            <div className="p-4 bg-rose-50/80 rounded-2xl border border-rose-200 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-rose-950">
                  ชุดน้ำยา: LOT {pendingExpiredRecord.lotNumber}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-rose-200 text-rose-900 text-[10px] font-black">
                  {pendingExpiredLotInfo.statusText}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 text-slate-700">
                <div>
                  <span className="text-slate-400 block text-[10px]">วันหมดอายุใช้งานจริง</span>
                  <strong className="text-rose-700 font-black">{pendingExpiredLotInfo.effectiveExpDate || '-'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">เกินกำหนดมาแล้ว</span>
                  <strong className="text-rose-700 font-black">{Math.abs(pendingExpiredLotInfo.daysRemaining || 0)} วัน</strong>
                </div>
              </div>

              <div className="pt-2 border-t border-rose-200/80 grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                <div>
                  <span className="text-slate-400 block text-[10px]">หน่วยงาน (Ward)</span>
                  <strong className="text-slate-900 font-bold">{pendingExpiredRecord.ward}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">เครื่อง DTX</span>
                  <strong className="text-sky-800 font-mono font-bold">{pendingExpiredRecord.serialNumber}</strong>
                </div>
              </div>

              <div className="p-2 bg-white rounded-xl border border-rose-200 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">ผลตรวจที่กรอก:</span>
                <div className="flex items-center space-x-2 font-mono font-bold">
                  <span className="text-emerald-700">L1: {pendingExpiredRecord.level1}</span>
                  <span className="text-sky-700">L2: {pendingExpiredRecord.level2}</span>
                  <span className="text-purple-700">L3: {pendingExpiredRecord.level3}</span>
                </div>
              </div>
            </div>

            {/* Recommendation note */}
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] flex items-start space-x-2">
              <Info size={16} className="shrink-0 text-amber-600 mt-0.5" />
              <p>
                <strong>คำแนะนำมาตรฐาน:</strong> ควรยกเลิกและนำน้ำยา Control ขวดใหม่มาตรวจซ้ำ เพื่อให้มั่นใจในความถูกต้องของผลตรวจตามมาตรฐานห้องปฏิบัติการ
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowExpiredPromptDialog(false);
                  setPendingExpiredRecord(null);
                  setPendingExpiredLotInfo(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer transition-all"
              >
                🛑 ยกเลิก (เพื่อเปลี่ยนขวดน้ำยาใหม่)
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmExpiredSave}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-md shadow-rose-500/20 disabled:opacity-50 transition-all"
              >
                {isSubmitting ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                <span>ยืนยันบันทึกผล</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
