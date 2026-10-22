/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import CustomSelect from "./CustomSelect";
import QCComparisonChart from './QCComparisonChart';
import { DtxMachine, QcRecord, QcLotConfig, MasterWard, StripReagentItem, QcCorrectiveAction } from '../types';
import { dbService } from '../lib/supabase';
import { getThaiTodayDateOnly, formatThaiDateOnly } from '../lib/dateUtils';
import { 
  SlidersVertical, Activity, Plus, TrendingUp, AlertTriangle, 
  CheckCircle2, Download, Settings, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight,
  Lightbulb, Eye, Check, Calendar, User, Zap, BarChart3, 
  FileSpreadsheet, ShieldAlert, Sparkles, Filter, RefreshCw,
  Clock, Hourglass, Bell, Send, Share2, Copy, AlertOctagon, Info,
  TableProperties, CheckSquare, Layers, Trash2, Calculator, Package,
  PackageCheck, X
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
    const [y, m, day] = String(lot.openDate).split('-').map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(day)) {
      const d = new Date(y, m - 1, day + Number(lot.openExpDays));
      const expY = d.getFullYear();
      const expM = String(d.getMonth() + 1).padStart(2, '0');
      const expD = String(d.getDate()).padStart(2, '0');
      openExpiryDate = `${expY}-${expM}-${expD}`;
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
  onUpdateQcRecord?: (id: string, updatedFields: Partial<QcRecord>) => Promise<void> | void;
  onUpdateLotConfigs: (configs: QcLotConfig[]) => void;
  onDeleteLotConfig?: (lotNumber: string) => void;
  role?: string;
  initialTab?: 'batch' | 'history' | 'config';
}

export type QcTab = 'batch' | 'chart' | 'comparison' | 'table' | 'config';

export default function QCManagement({
  machines,
  qcRecords,
  lotConfigs,
  onAddQcRecord,
  onUpdateQcRecord,
  onUpdateLotConfigs,
  onDeleteLotConfig,
  role = 'admin',
  initialTab = 'batch'
}: QCManagementProps) {
  // Main view tab: 'batch', 'chart' (LJ), 'comparison', 'table', 'config'
  const [activeTab, setActiveTab] = useState<QcTab>(() => {
    if (initialTab === 'history') return 'chart';
    if (initialTab === 'config') return 'config';
    return 'batch';
  });

  // --- QC CORRECTIVE ACTION (CA) STATES & HANDLERS ---
  const [isCaModalOpen, setIsCaModalOpen] = useState<boolean>(false);
  const [shakingSerials, setShakingSerials] = useState<string[]>([]);
  const [batchErrorMessage, setBatchErrorMessage] = useState<string>("");
  const [caViewMode, setCaViewMode] = useState<"report" | "edit">("report");
  const [selectedQcForCa, setSelectedQcForCa] = useState<QcRecord | null>(null);
  const [caForm, setCaForm] = useState({
    stripExpNormal: true,
    controlExpNormal: true,
    controlOpenDays: 0,
    machineConditionClean: true,
    repeatLevel1: "",
    repeatLevel2: "",
    repeatLevel3: "",
    probableCause: "น้ำยาควบคุมเสื่อมสภาพ/หมดอายุ",
    correctiveActionNote: ""
  });

  const handleOpenCaModal = (qc: QcRecord, forceMode?: "report" | "edit") => {
    setSelectedQcForCa(qc);
    const mode = forceMode || (qc.correctiveAction ? "report" : "edit");
    setCaViewMode(mode);
    if (qc.correctiveAction) {
      setCaForm({
        stripExpNormal: qc.correctiveAction.stripChecked !== undefined 
          ? qc.correctiveAction.stripChecked 
          : qc.correctiveAction.stripExpStatus !== "expired",
        controlExpNormal: qc.correctiveAction.controlChecked !== undefined 
          ? qc.correctiveAction.controlChecked 
          : qc.correctiveAction.controlExpStatus !== "expired",
        controlOpenDays: qc.correctiveAction.openDays !== undefined 
          ? qc.correctiveAction.openDays 
          : (qc.correctiveAction.controlOpenDays || 0),
        machineConditionClean: qc.correctiveAction.machineChecked !== undefined
          ? qc.correctiveAction.machineChecked
          : !qc.correctiveAction.machineCondition?.includes("ผิดปกติ"),
        repeatLevel1: qc.correctiveAction.repeatLevel1 || "",
        repeatLevel2: qc.correctiveAction.repeatLevel2 || "",
        repeatLevel3: qc.correctiveAction.repeatLevel3 || "",
        probableCause: qc.correctiveAction.probableCause || "น้ำยาควบคุมเสื่อมสภาพ/หมดอายุ",
        correctiveActionNote: qc.correctiveAction.correctiveActionNote || ""
      });
    } else {
      setCaForm({
        stripExpNormal: true,
        controlExpNormal: true,
        controlOpenDays: 0,
        machineConditionClean: true,
        repeatLevel1: "",
        repeatLevel2: "",
        repeatLevel3: "",
        probableCause: "น้ำยาควบคุมเสื่อมสภาพ/หมดอายุ",
        correctiveActionNote: ""
      });
    }
    setIsCaModalOpen(true);
  };

  const handleSaveCa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQcForCa) return;
    const caTargetLot = lotConfigs.find(l => l.lotNumber === selectedQcForCa.lotNumber) || activeLotConfig;
    const evaluateVal = (valStr: string, min: number, max: number, target: number, sd: number) => {
      if (!valStr.trim()) return "empty";
      const val = Number(valStr);
      if (isNaN(val)) return "empty";
      if (min !== undefined && max !== undefined && (min !== 0 || max !== 0)) {
        return (val < min || val > max) ? "out_of_control" : "normal";
      }
      return (val < target - 3 * sd || val > target + 3 * sd) ? "out_of_control" : "normal";
    };
    const repL1Status = evaluateVal(caForm.repeatLevel1, caTargetLot?.level1Min || 0, caTargetLot?.level1Max || 0, caTargetLot?.level1Target || 0, caTargetLot?.level1SD || 1);
    const repL2Status = evaluateVal(caForm.repeatLevel2, caTargetLot?.level2Min || 0, caTargetLot?.level2Max || 0, caTargetLot?.level2Target || 0, caTargetLot?.level2SD || 1);
    const repL3Status = evaluateVal(caForm.repeatLevel3, caTargetLot?.level3Min || 0, caTargetLot?.level3Max || 0, caTargetLot?.level3Target || 0, caTargetLot?.level3SD || 1);
    const isRepeatComplete = Boolean(caForm.repeatLevel1.trim() && caForm.repeatLevel2.trim() && caForm.repeatLevel3.trim());
    const isRepeatAllIn = isRepeatComplete && repL1Status === "normal" && repL2Status === "normal" && repL3Status === "normal";
    const isRepeatAnyOut = repL1Status === "out_of_control" || repL2Status === "out_of_control" || repL3Status === "out_of_control";

    const caData: QcCorrectiveAction = {
      stripChecked: caForm.stripExpNormal,
      controlChecked: caForm.controlExpNormal,
      openDays: Number(caForm.controlOpenDays) || 0,
      openDaysPassed: (Number(caForm.controlOpenDays) || 0) <= 90,
      machineChecked: caForm.machineConditionClean,
      stripExpStatus: caForm.stripExpNormal ? "normal" : "expired",
      controlExpStatus: caForm.controlExpNormal ? "normal" : "expired",
      controlOpenDays: Number(caForm.controlOpenDays) || 0,
      machineCondition: caForm.machineConditionClean ? "ช่องใส่แถบตรวจสะอาด / ทำงานปกติ" : "พบความผิดปกติที่เครื่อง/ช่องใส่แถบตรวจ",
      repeatLevel1: caForm.repeatLevel1,
      repeatLevel2: caForm.repeatLevel2,
      repeatLevel3: caForm.repeatLevel3,
      repeatLevel1Status: repL1Status as any,
      repeatLevel2Status: repL2Status as any,
      repeatLevel3Status: repL3Status as any,
      repeatOverallStatus: isRepeatAllIn ? "in_control" : (isRepeatAnyOut ? "out_of_control" : "pending"),
      probableCause: caForm.probableCause,
      correctiveActionNote: caForm.correctiveActionNote,
      operator: operator.trim(),
      date: getThaiTodayDateOnly(),
      resolvedAt: new Date().toISOString()
    };
    try {
      if (onUpdateQcRecord) {
        await onUpdateQcRecord(selectedQcForCa.id, { correctiveAction: caData });
      }
      setSelectedQcForCa(prev => prev ? { ...prev, correctiveAction: caData } : null);
      setCaViewMode("report");
      setBatchToast(" บันทึกข้อมูลการทวนสอบและแก้ไข Out of Control (CA) สำเร็จ!");
      setTimeout(() => setBatchToast(""), 4000);
    } catch (err: any) {
      alert(` ไม่สามารถบันทึกข้อมูล CA ได้: ${err?.message || err}`);
    }
  };

  useEffect(() => {
    if (initialTab) {
      if (initialTab === 'history') {
        setActiveTab('chart');
      } else {
        setActiveTab(initialTab as any);
      }
    }
  }, [initialTab]);
  const [wards, setWards] = useState<MasterWard[]>([]);

  useEffect(() => {
    dbService.getWards()
      .then(setWards)
      .catch(err => console.error("Failed to fetch wards:", err));
  }, []);

  // Sort lotConfigs so latest lot (by expDate / lotNumber) is always at the top
  const sortedLotConfigs = useMemo(() => {
    return [...lotConfigs].sort((a, b) => {
      if (a.expDate && b.expDate) {
        return new Date(b.expDate).getTime() - new Date(a.expDate).getTime();
      }
      if (a.expDate) return -1;
      if (b.expDate) return 1;
      return b.lotNumber.localeCompare(a.lotNumber, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [lotConfigs]);

  // Quick QC Entry Form States
  const [operator, setOperator] = useState<string>(() => localStorage.getItem('dtx_qc_operator') || '');
  const [qcDate, setQcDate] = useState<string>(() => getThaiTodayDateOnly());

  // Toggle state for Machine Column Display: 'code' | 'sn' | 'both'
  const [machineDisplayMode, setMachineDisplayMode] = useState<'code' | 'sn' | 'both'>(() => {
    return (localStorage.getItem('dtx_qc_machine_display_mode') as any) || 'code';
  });

  useEffect(() => {
    localStorage.setItem('dtx_qc_machine_display_mode', machineDisplayMode);
  }, [machineDisplayMode]);

  // Helper to format machine display text based on machineDisplayMode
  const formatMachineLabel = (codeOrId: string) => {
    if (!codeOrId) return '-';
    const cleanKey = codeOrId.trim().toUpperCase();
    const machine = machines.find(m => 
      (m.serialNumber && m.serialNumber.trim().toUpperCase() === cleanKey) ||
      (m.id && m.id === codeOrId)
    );
    const code = machine?.serialNumber || codeOrId;
    const sn = (machine?.machineSerial && machine.machineSerial !== '-') ? machine.machineSerial.trim() : '';

    if (machineDisplayMode === 'sn') {
      return sn || code;
    }
    if (machineDisplayMode === 'both') {
      return sn ? `${code} (${sn})` : code;
    }
    return code;
  };

  // Immediately update to current date on new login session / operator change and focus
  useEffect(() => {
    setQcDate(getThaiTodayDateOnly());
    setBatchDate(getThaiTodayDateOnly());
  }, [operator]);

  useEffect(() => {
    const handleFocus = () => {
      setQcDate(getThaiTodayDateOnly());
      setBatchDate(getThaiTodayDateOnly());
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        setQcDate(getThaiTodayDateOnly());
        setBatchDate(getThaiTodayDateOnly());
      }
    });
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
  const [selectedWard, setSelectedWard] = useState<string>('');
  const [selectedSerial, setSelectedSerial] = useState<string>('');
  const [selectedLot, setSelectedLot] = useState<string>(() => {
    const list = [...lotConfigs].sort((a, b) => {
      if (a.expDate && b.expDate) return new Date(b.expDate).getTime() - new Date(a.expDate).getTime();
      if (a.expDate) return -1;
      if (b.expDate) return 1;
      return b.lotNumber.localeCompare(a.lotNumber, undefined, { numeric: true, sensitivity: 'base' });
    });
    return list[0]?.lotNumber || 'LOT2026-A';
  });
  const [level1Val, setLevel1Val] = useState<string>('');
  const [level2Val, setLevel2Val] = useState<string>('');
  const [level3Val, setLevel3Val] = useState<string>('');
  const [entrySuccessToast, setEntrySuccessToast] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // --- LEVEY-JENNINGS CHART: BY MACHINE & SELECTABLE TIME RANGE ---
  const [chartFilterWard, setChartFilterWard] = useState<string>("");
  const [chartMachineSerial, setChartMachineSerial] = useState<string>(() => {
    return localStorage.getItem("dtx_lj_chart_machine_serial") || "";
  });
  const [chartTimeRangePreset, setChartTimeRangePreset] = useState<"7days" | "15days" | "30days" | "this_month" | "all" | "custom">("30days");
  const [chartStartDate, setChartStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().substring(0, 10);
  });
  const [chartEndDate, setChartEndDate] = useState<string>(() => getThaiTodayDateOnly());
  const [chartSelectedLot, setChartSelectedLot] = useState<string>("all");
  const [selectedChartLevel, setSelectedChartLevel] = useState<"all" | 1 | 2 | 3>("all");

  const setRangePreset = (preset: "7days" | "15days" | "30days" | "this_month" | "all") => {
    setChartTimeRangePreset(preset);
    const today = getThaiTodayDateOnly();
    if (preset === "all") {
      setChartStartDate("");
      setChartEndDate("");
    } else if (preset === "this_month") {
      const yearMonth = today.substring(0, 7);
      setChartStartDate(`${yearMonth}-01`);
      setChartEndDate(today);
    } else {
      const days = preset === "7days" ? 7 : preset === "15days" ? 15 : 30;
      const d = new Date();
      d.setDate(d.getDate() - days);
      setChartStartDate(d.toISOString().substring(0, 10));
      setChartEndDate(today);
    }
  };

  // Filter states for History Table
  const [filterWard, setFilterWard] = useState<string>('');
  const [filterLot, setFilterLot] = useState<string>(() => {
    const list = [...lotConfigs].sort((a, b) => {
      if (a.expDate && b.expDate) return new Date(b.expDate).getTime() - new Date(a.expDate).getTime();
      if (a.expDate) return -1;
      if (b.expDate) return 1;
      return b.lotNumber.localeCompare(a.lotNumber, undefined, { numeric: true, sensitivity: 'base' });
    });
    return list[0]?.lotNumber || 'LOT2026-A';
  });
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterSerial, setFilterSerial] = useState<string>('');
  const [dateRangeMode, setDateRangeMode] = useState<'all' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
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
    lot?: string;
  } | null>(null);

  // Pagination for History Table
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

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
  const [isSavingLot, setIsSavingLot] = useState<boolean>(false);

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
    return sortedLotConfigs.find(c => c.lotNumber === selectedLot) || sortedLotConfigs[0];
  }, [sortedLotConfigs, selectedLot]);

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
  const [batchLot, setBatchLot] = useState<string>(() => {
    const list = [...lotConfigs].sort((a, b) => {
      if (a.expDate && b.expDate) return new Date(b.expDate).getTime() - new Date(a.expDate).getTime();
      if (a.expDate) return -1;
      if (b.expDate) return 1;
      return b.lotNumber.localeCompare(a.lotNumber, undefined, { numeric: true, sensitivity: 'base' });
    });
    return list[0]?.lotNumber || 'LOT2026-A';
  });
  const [batchDate, setBatchDate] = useState<string>(() => getThaiTodayDateOnly());

  // Sync lots when sortedLotConfigs change
  useEffect(() => {
    if (sortedLotConfigs.length > 0) {
      if (!sortedLotConfigs.some(c => c.lotNumber === batchLot)) {
        setBatchLot(sortedLotConfigs[0].lotNumber);
      }
      if (!sortedLotConfigs.some(c => c.lotNumber === selectedLot)) {
        setSelectedLot(sortedLotConfigs[0].lotNumber);
      }
      if (!sortedLotConfigs.some(c => c.lotNumber === filterLot)) {
        setFilterLot(sortedLotConfigs[0].lotNumber);
      }
    }
  }, [sortedLotConfigs]);
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

  // Toggle state for LJ Chart & Comparison inside History view
  const [historyViewMode, setHistoryViewMode] = useState<"chart" | "comparison" | "table">(() => {
    const saved = localStorage.getItem("dtx_qc_history_view_mode");
    return (saved === "table" || saved === "chart" || saved === "comparison") ? (saved as any) : "chart";
  });

  useEffect(() => {
    localStorage.setItem("dtx_qc_history_view_mode", historyViewMode);
  }, [historyViewMode]);

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
      if (colFilterSerial) {
        const q = colFilterSerial.toLowerCase();
        const matchCode = row.serialNumber.toLowerCase().includes(q);
        const m = machines.find(x => x.serialNumber === row.serialNumber || x.id === row.machineId);
        const matchSN = m?.machineSerial?.toLowerCase().includes(q);
        if (!matchCode && !matchSN) return false;
      }
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

  // Batch Sub-Page Pagination State
  const [batchPage, setBatchPage] = useState<number>(1);
  const [batchPageSize, setBatchPageSize] = useState<number>(10);

  // Reset batch page when filters change
  useEffect(() => {
    setBatchPage(1);
  }, [batchScope, batchWardFilter, colFilterWard, colFilterSerial, colFilterL1, colFilterL2, colFilterL3, colFilterStatus]);

  const effectiveBatchPageSize = batchPageSize === 0 ? Math.max(1, filteredBatchRows.length) : batchPageSize;
  const totalBatchPages = Math.max(1, Math.ceil(filteredBatchRows.length / effectiveBatchPageSize));

  useEffect(() => {
    if (batchPage > totalBatchPages) {
      setBatchPage(totalBatchPages);
    }
  }, [batchPage, totalBatchPages]);

  const paginatedBatchRows = useMemo(() => {
    if (batchPageSize === 0) return filteredBatchRows;
    const startIndex = (batchPage - 1) * batchPageSize;
    return filteredBatchRows.slice(startIndex, startIndex + batchPageSize);
  }, [filteredBatchRows, batchPage, batchPageSize]);

  // Toggle selection for current page
  const handleToggleSelectCurrentBatchPage = (select: boolean) => {
    const pageSerials = new Set(paginatedBatchRows.map(r => r.serialNumber));
    setBatchRows(rows => rows.map(r => pageSerials.has(r.serialNumber) ? { ...r, selected: select } : r));
  };

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
      let firstOutRecord: QcRecord | null = null;
      for (const row of validRows) {
        const l1 = Number(row.level1);
        const l2 = Number(row.level2);
        const l3 = Number(row.level3);

        const newRec: QcRecord = {
          id: crypto.randomUUID(),
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

      setBatchToast(` บันทึกผล QC แบบชุดสำเร็จทั้งหมด ${savedCount} เครื่อง (${batchLot})`);
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
      id: crypto.randomUUID(),
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
      setEntrySuccessToast(` บันทึกผล QC เครื่อง ${selectedSerial} (${selectedWard}) สำเร็จ`);
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
      setEntrySuccessToast(` บันทึกผล QC เครื่อง ${pendingExpiredRecord.serialNumber} (${pendingExpiredRecord.ward}) เรียบร้อยแล้ว`);
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
  const getCalculatedStats = (records: QcRecord[], lot: string, level: 1 | 2 | 3, month: string, ward: string, serial: string, mode: string, start: string, end: string) => {
    const config = lotConfigs.find(c => c.lotNumber === lot);
    const filtered = records.filter(r => {
      const matchLot = r.lotNumber === lot;
      const matchWard = ward === '' || r.ward === ward;
      const matchMonth = month === '' || r.date.startsWith(month);
      const matchSerial = serial === '' || r.serialNumber === serial;
      
      let matchDate = true;
      if (mode === 'custom') {
        const d = r.date.substring(0, 10);
        if (start && d < start) matchDate = false;
        if (end && d > end) matchDate = false;
      }
      return matchLot && matchWard && matchMonth && matchSerial && matchDate;
    });
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

  // --- Available Machines for LJ Chart (Combo: Ward -> Machine) ---
  const allChartMachines = useMemo(() => {
    const map = new Map<string, { serialNumber: string; displayLabel: string; ward: string; brand: string }>();

    // 1. Registered machines
    machines.forEach(m => {
      const serial = m.serialNumber || m.id;
      if (serial) {
        map.set(serial.trim().toUpperCase(), {
          serialNumber: serial.trim(),
          displayLabel: formatMachineLabel(serial),
          ward: m.ward || "งานชันสูตรสาธารณสุข",
          brand: m.brand || ""
        });
      }
    });

    // 2. Additional machines from qcRecords
    qcRecords.forEach(r => {
      if (r.serialNumber) {
        const key = r.serialNumber.trim().toUpperCase();
        if (!map.has(key)) {
          map.set(key, {
            serialNumber: r.serialNumber.trim(),
            displayLabel: formatMachineLabel(r.serialNumber),
            ward: r.ward || "งานชันสูตรสาธารณสุข",
            brand: ""
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.serialNumber.localeCompare(b.serialNumber, undefined, { numeric: true }));
  }, [machines, qcRecords, machineDisplayMode]);

  // Cascading Filter: Filter machines by selected Ward (Combo)
  const filteredChartMachines = useMemo(() => {
    if (!chartFilterWard) return allChartMachines;
    return allChartMachines.filter(m => m.ward === chartFilterWard);
  }, [allChartMachines, chartFilterWard]);

  // Legacy alias for compatibility
  const availableChartMachines = filteredChartMachines;

  // Current machine index in the filtered machines list
  const currentMachineIndex = useMemo(() => {
    if (!chartMachineSerial || filteredChartMachines.length === 0) return -1;
    return filteredChartMachines.findIndex(m => m.serialNumber.toUpperCase() === chartMachineSerial.toUpperCase());
  }, [filteredChartMachines, chartMachineSerial]);

  // Machine previews for Flank Buttons
  const prevMachineObj = useMemo(() => {
    if (filteredChartMachines.length <= 1 || currentMachineIndex === -1) return null;
    const prevIdx = currentMachineIndex <= 0 ? filteredChartMachines.length - 1 : currentMachineIndex - 1;
    return filteredChartMachines[prevIdx];
  }, [filteredChartMachines, currentMachineIndex]);

  const nextMachineObj = useMemo(() => {
    if (filteredChartMachines.length <= 1 || currentMachineIndex === -1) return null;
    const nextIdx = currentMachineIndex >= filteredChartMachines.length - 1 ? 0 : currentMachineIndex + 1;
    return filteredChartMachines[nextIdx];
  }, [filteredChartMachines, currentMachineIndex]);

  // Keyboard navigation (ArrowLeft / ArrowRight) for switching machines
  useEffect(() => {
    if (activeTab !== "chart") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevMachine();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNextMachine();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, filteredChartMachines, currentMachineIndex]);

  // Reference and position tracking for floating flank stepper buttons outside content area
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [navPositions, setNavPositions] = useState<{
    visible: boolean;
    leftX: number;
    rightX: number;
  }>({
    visible: false,
    leftX: 0,
    rightX: 0,
  });

  useEffect(() => {
    if (activeTab !== "chart" || filteredChartMachines.length <= 1) {
      setNavPositions(prev => ({ ...prev, visible: false }));
      return;
    }

    const updatePositions = () => {
      if (!chartContainerRef.current) return;
      const chartRect = chartContainerRef.current.getBoundingClientRect();
      const sidebarEl = document.getElementById("admin-sidebar");
      const sidebarRight = sidebarEl ? sidebarEl.getBoundingClientRect().right : 0;

      // Check if chart section is currently visible in viewport (follows vertical scroll)
      const isInView = chartRect.top < window.innerHeight - 80 && chartRect.bottom > 80;

      const buttonWidth = 44;
      const marginGap = 12;

      // Left button: Positioned strictly outside chart border, but clamped so it NEVER overlaps sidebar!
      const idealLeft = chartRect.left - buttonWidth - marginGap;
      const safeLeft = Math.max(sidebarRight + 12, idealLeft);

      // Right button: Positioned strictly outside chart right border, but clamped so it does not overflow screen
      const idealRight = chartRect.right + marginGap;
      const safeRight = Math.min(window.innerWidth - buttonWidth - 12, idealRight);

      setNavPositions({
        visible: isInView,
        leftX: safeLeft,
        rightX: safeRight,
      });
    };

    updatePositions();
    window.addEventListener("scroll", updatePositions, { passive: true });
    window.addEventListener("resize", updatePositions, { passive: true });

    // Watch for smooth sidebar collapse/expand animations
    const interval = setInterval(updatePositions, 60);
    const timeout = setTimeout(() => clearInterval(interval), 1000);

    return () => {
      window.removeEventListener("scroll", updatePositions);
      window.removeEventListener("resize", updatePositions);
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [activeTab, filteredChartMachines.length]);

  // Stepper handlers to navigate between machines one by one
  const handlePrevMachine = () => {
    if (filteredChartMachines.length === 0) return;
    const newIdx = currentMachineIndex <= 0 ? filteredChartMachines.length - 1 : currentMachineIndex - 1;
    setChartMachineSerial(filteredChartMachines[newIdx].serialNumber);
  };

  const handleNextMachine = () => {
    if (filteredChartMachines.length === 0) return;
    const newIdx = currentMachineIndex >= filteredChartMachines.length - 1 ? 0 : currentMachineIndex + 1;
    setChartMachineSerial(filteredChartMachines[newIdx].serialNumber);
  };

  // Ensure an initial machine is selected from the active filtered list
  useEffect(() => {
    if (filteredChartMachines.length > 0) {
      const exists = filteredChartMachines.some(m => m.serialNumber.toUpperCase() === chartMachineSerial.toUpperCase());
      if (!exists) {
        setChartMachineSerial(filteredChartMachines[0].serialNumber);
      }
    }
  }, [filteredChartMachines, chartMachineSerial]);

  // Save selected machine to localStorage
  useEffect(() => {
    if (chartMachineSerial) {
      localStorage.setItem("dtx_lj_chart_machine_serial", chartMachineSerial);
    }
  }, [chartMachineSerial]);

  const currentChartMachineObj = useMemo(() => {
    if (!chartMachineSerial) return null;
    return allChartMachines.find(m => m.serialNumber.toUpperCase() === chartMachineSerial.toUpperCase()) || null;
  }, [allChartMachines, chartMachineSerial]);

  // Machine used LOTs
  const machineUsedLots = useMemo(() => {
    if (!chartMachineSerial) return [];
    const cleanSerial = chartMachineSerial.trim().toUpperCase();
    const lots = new Set<string>();
    qcRecords.forEach(r => {
      if ((r.serialNumber || "").trim().toUpperCase() === cleanSerial && r.lotNumber) {
        lots.add(r.lotNumber.trim());
      }
    });
    return Array.from(lots).sort();
  }, [qcRecords, chartMachineSerial]);

  // Machine Chart Records filtered by machine, date range, and optional lot
  const machineChartRecords = useMemo(() => {
    if (!chartMachineSerial) return [];
    const cleanSerial = chartMachineSerial.trim().toUpperCase();

    return qcRecords
      .filter(r => {
        // 1. Must match selected machine
        const rSerial = (r.serialNumber || "").trim().toUpperCase();
        if (rSerial !== cleanSerial) return false;

        // 2. Optional LOT filter
        if (chartSelectedLot && chartSelectedLot !== "all" && r.lotNumber !== chartSelectedLot) {
          return false;
        }

        // 3. Date range filter
        const recDate = r.date.substring(0, 10);
        if (chartStartDate && recDate < chartStartDate) return false;
        if (chartEndDate && recDate > chartEndDate) return false;

        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [qcRecords, chartMachineSerial, chartSelectedLot, chartStartDate, chartEndDate]);

  // Date range label
  const dateRangeLabel = useMemo(() => {
    if (!chartStartDate && !chartEndDate) return "ทุกช่วงเวลา (All time)";
    if (chartStartDate && chartEndDate) {
      return `${formatThaiDateOnly(chartStartDate)} ถึง ${formatThaiDateOnly(chartEndDate)}`;
    }
    if (chartStartDate) return `ตั้งแต่ ${formatThaiDateOnly(chartStartDate)}`;
    return `จนถึง ${formatThaiDateOnly(chartEndDate)}`;
  }, [chartStartDate, chartEndDate]);

  // Machine Stats Calculations for LJ Chart
  const getMachineStats = (records: QcRecord[], level: 1 | 2 | 3) => {
    const values: number[] = [];
    let outCount = 0;
    records.forEach(r => {
      const val = level === 1 ? Number(r.level1) : level === 2 ? Number(r.level2) : Number(r.level3);
      const status = level === 1 ? r.level1Status : level === 2 ? r.level2Status : r.level3Status;
      if (!isNaN(val) && val > 0) {
        values.push(val);
        if (status === "out_of_control") outCount++;
      }
    });

    const n = values.length;
    const refLot = (chartSelectedLot && chartSelectedLot !== "all")
      ? chartSelectedLot
      : records[records.length - 1]?.lotNumber || records[0]?.lotNumber || lotConfigs[0]?.lotNumber;
    const config = lotConfigs.find(c => c.lotNumber === refLot);

    const configTarget = config ? (level === 1 ? config.level1Target : level === 2 ? config.level2Target : config.level3Target) : 0;
    const configSD = config ? (level === 1 ? config.level1SD : level === 2 ? config.level2SD : config.level3SD) : 0;

    if (n === 0) {
      return {
        n: 0,
        mean: configTarget,
        sd: configSD || 1,
        cv: 0,
        outOfControlCount: 0,
        target: configTarget,
        targetSD: configSD || 1,
        lotRef: refLot || "-"
      };
    }

    const sum = values.reduce((acc, v) => acc + v, 0);
    const mean = Math.round((sum / n) * 100) / 100;
    let sd = 0;
    if (n > 1) {
      const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n - 1);
      sd = Math.round(Math.sqrt(variance) * 100) / 100;
    } else {
      sd = configSD || 1;
    }
    const cv = mean > 0 ? Math.round((sd / mean) * 10000) / 100 : 0;

    return {
      n,
      mean,
      sd,
      cv,
      outOfControlCount: outCount,
      target: configTarget || mean,
      targetSD: configSD || sd || 1,
      lotRef: refLot || "-"
    };
  };

  const level1Stats = useMemo(() => getMachineStats(machineChartRecords, 1), [machineChartRecords, chartSelectedLot, lotConfigs]);
  const level2Stats = useMemo(() => getMachineStats(machineChartRecords, 2), [machineChartRecords, chartSelectedLot, lotConfigs]);
  const level3Stats = useMemo(() => getMachineStats(machineChartRecords, 3), [machineChartRecords, chartSelectedLot, lotConfigs]);

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
  const todayDateStr = getThaiTodayDateOnly();
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
    link.setAttribute('download', `QC_Records_${filterLot}_${getThaiTodayDateOnly()}.csv`);
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
        level1Target: 36, level1Min: 21, level1Max: 51, level1SD: 5,
        level2Target: 111, level2Min: 89, level2Max: 133, level2SD: 7.3,
        level3Target: 326.5, level3Min: 261, level3Max: 392, level3SD: 21.8,
      });
    }
  };

  const handleOpenAddLotModal = () => {
    setEditingLotIdx(lotConfigs.length);
    setEditedLot({
      lotNumber: '',
      manufacturer: 'VivaChek Fad',
      expDate: '',
      openExpDays: 90,
      notes: '',
      level1Target: 36, level1Min: 21, level1Max: 51, level1SD: 5,
      level2Target: 111, level2Min: 89, level2Max: 133, level2SD: 7.3,
      level3Target: 326.5, level3Min: 261, level3Max: 392, level3SD: 21.8,
    });
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
      alert(` ลบการตั้งค่าช่วงมาตรฐาน LOT ${cleanLot} สำเร็จเรียบร้อยแล้ว`);
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

    const defaultSD = level === 1 ? 5 : level === 2 ? 7.3 : 21.8;
    let target = (editedLot[targetKey] as number) || 0;
    let sd = (editedLot[sdKey] as number) || defaultSD;
    let min = (editedLot[minKey] as number) || 0;
    let max = (editedLot[maxKey] as number) || 0;

    if (field === 'min') {
      min = val;
      if (min > 0 && max > min) {
        target = Math.round(((min + max) / 2) * 10) / 10;
        sd = Math.round(((max - min) / 4) * 10) / 10;
      }
    } else if (field === 'max') {
      max = val;
      if (min > 0 && max > min) {
        target = Math.round(((min + max) / 2) * 10) / 10;
        sd = Math.round(((max - min) / 4) * 10) / 10;
      }
    } else if (field === 'target') {
      target = val;
      if (target > 0) {
        const currentSD = sd > 0 ? sd : defaultSD;
        min = Math.max(0, Math.round(target - currentSD * 2));
        max = Math.round(target + currentSD * 2);
        sd = currentSD;
      }
    } else if (field === 'sd') {
      sd = val;
      if (target > 0 && sd > 0) {
        min = Math.max(0, Math.round(target - 2 * sd));
        max = Math.round(target + 2 * sd);
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

  const handleSaveLotConfig = async () => {
    if (!editedLot || !editedLot.lotNumber.trim()) {
      alert('กรุณาระบุหรือเลือกล็อต (LOT Number)');
      return;
    }
    const cleanLot = editedLot.lotNumber.trim();
    const toSave: QcLotConfig = {
      ...editedLot,
      lotNumber: cleanLot,
      level1Target: Number(editedLot.level1Target) || 0,
      level1Min: Number(editedLot.level1Min) || 0,
      level1Max: Number(editedLot.level1Max) || 0,
      level1SD: Number(editedLot.level1SD) || 0,
      level2Target: Number(editedLot.level2Target) || 0,
      level2Min: Number(editedLot.level2Min) || 0,
      level2Max: Number(editedLot.level2Max) || 0,
      level2SD: Number(editedLot.level2SD) || 0,
      level3Target: Number(editedLot.level3Target) || 0,
      level3Min: Number(editedLot.level3Min) || 0,
      level3Max: Number(editedLot.level3Max) || 0,
      level3SD: Number(editedLot.level3SD) || 0,
    };

    setIsSavingLot(true);
    try {
      const saved = await dbService.saveLotConfig(toSave);
      const filtered = lotConfigs.filter(c => c.lotNumber.trim().toUpperCase() !== cleanLot.toUpperCase());
      onUpdateLotConfigs([...filtered, saved || toSave]);
      setEditingLotIdx(null);
      setEditedLot(null);
      alert(` บันทึกการตั้งค่า Target Range สำหรับ LOT ${cleanLot} สำเร็จเรียบร้อยแล้ว`);
    } catch (err: any) {
      console.error('Failed to save lot config:', err);
      alert(`เกิดข้อผิดพลาดในการบันทึก LOT Config: ${err?.message || err}`);
    } finally {
      setIsSavingLot(false);
    }
  };

  // CA Modal calculations
  const caTargetLot = selectedQcForCa ? (lotConfigs.find(l => l.lotNumber === selectedQcForCa.lotNumber) || activeLotConfig) : activeLotConfig;
  const evaluateCaVal = (valStr: string, min: number, max: number, target: number, sd: number) => {
    if (!valStr || !valStr.trim()) return "empty";
    const val = Number(valStr);
    if (isNaN(val)) return "empty";
    if (min !== undefined && max !== undefined && (min !== 0 || max !== 0)) {
      return (val < min || val > max) ? "out_of_control" : "normal";
    }
    return (val < target - 3 * sd || val > target + 3 * sd) ? "out_of_control" : "normal";
  };
  const repL1Status = selectedQcForCa ? evaluateCaVal(caForm.repeatLevel1, caTargetLot?.level1Min || 0, caTargetLot?.level1Max || 0, caTargetLot?.level1Target || 0, caTargetLot?.level1SD || 1) : "empty";
  const repL2Status = selectedQcForCa ? evaluateCaVal(caForm.repeatLevel2, caTargetLot?.level2Min || 0, caTargetLot?.level2Max || 0, caTargetLot?.level2Target || 0, caTargetLot?.level2SD || 1) : "empty";
  const repL3Status = selectedQcForCa ? evaluateCaVal(caForm.repeatLevel3, caTargetLot?.level3Min || 0, caTargetLot?.level3Max || 0, caTargetLot?.level3Target || 0, caTargetLot?.level3SD || 1) : "empty";
  const isRepeatComplete = Boolean(caForm.repeatLevel1.trim() && caForm.repeatLevel2.trim() && caForm.repeatLevel3.trim());
  const isRepeatAllIn = isRepeatComplete && repL1Status === "normal" && repL2Status === "normal" && repL3Status === "normal";
  const existingCa = selectedQcForCa?.correctiveAction;

  const renderCaModal = () => {
    if (!isCaModalOpen || !selectedQcForCa) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs overflow-y-auto max-h-[92vh]">
          {/* Modal Header */}
          <div className="flex items-start justify-between border-b border-slate-150 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                caViewMode === "report" ? "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
              }`}>
                {caViewMode === "report" ? <CheckCircle2 size={24} /> : <ShieldAlert size={24} />}
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {caViewMode === "report" ? "ใบบันทึกรายงานการทวนสอบและแก้ไขปัญหา (QC CA Report)" : "บันทึกทวนสอบและแก้ไข Out of Control (QC CA)"}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  เครื่อง: <strong className="font-mono text-slate-700 dark:text-slate-300">{formatMachineLabel(selectedQcForCa.serialNumber)}</strong> | วอร์ด: <strong>{selectedQcForCa.ward}</strong> | LOT: <span className="font-mono">{selectedQcForCa.lotNumber}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCaModalOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="ปิดหน้าต่าง"
            >
              <X size={20} />
            </button>
          </div>

          {/* REPORT VIEW */}
          {caViewMode === "report" && existingCa ? (
            <div className="space-y-4">
              {/* Summary Header Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">วันที่ตรวจพบปัญหา</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{selectedQcForCa.date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">ผู้ตรวจรอบแรก</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{selectedQcForCa.operator}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">ผู้บันทึกการทวนสอบ</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">{existingCa.operator || operator || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">สถานะการแก้ไข</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 mt-0.5">
                     ดำเนินการแก้ไขแล้ว
                  </span>
                </div>
              </div>

              {/* Original vs Repeat Comparison */}
              <div className="space-y-2">
                <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs flex items-center space-x-1.5">
                  <Activity size={14} className="text-sky-600" />
                  <span>ผลการตรวจเปรียบเทียบ (Original Out vs Repeat Test):</span>
                </h4>

                <div className="grid grid-cols-3 gap-2.5 text-center">
                  {/* Level 1 */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Level 1 (Low)</span>
                    <div className="text-[11px] text-slate-500">
                      เดิม: <strong className={selectedQcForCa.level1Status === "out_of_control" ? "text-rose-600 font-mono text-sm" : "font-mono"}>{selectedQcForCa.level1}</strong>
                    </div>
                    <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 block">ผลตรวจซ้ำ:</span>
                      <span className="text-base font-extrabold font-mono text-slate-800 dark:text-white">
                        {existingCa.repeatLevel1 || "-"}
                      </span>
                      {existingCa.repeatLevel1 && (
                        <span className={`block text-[10px] font-extrabold mt-0.5 ${
                          repL1Status === "normal" ? "text-emerald-600" : "text-rose-600"
                        }`}>
                          {repL1Status === "normal" ? " In Control" : " Out of Control"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Level 2 */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Level 2 (Normal)</span>
                    <div className="text-[11px] text-slate-500">
                      เดิม: <strong className={selectedQcForCa.level2Status === "out_of_control" ? "text-rose-600 font-mono text-sm" : "font-mono"}>{selectedQcForCa.level2}</strong>
                    </div>
                    <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 block">ผลตรวจซ้ำ:</span>
                      <span className="text-base font-extrabold font-mono text-slate-800 dark:text-white">
                        {existingCa.repeatLevel2 || "-"}
                      </span>
                      {existingCa.repeatLevel2 && (
                        <span className={`block text-[10px] font-extrabold mt-0.5 ${
                          repL2Status === "normal" ? "text-emerald-600" : "text-rose-600"
                        }`}>
                          {repL2Status === "normal" ? " In Control" : " Out of Control"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Level 3 */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Level 3 (High)</span>
                    <div className="text-[11px] text-slate-500">
                      เดิม: <strong className={selectedQcForCa.level3Status === "out_of_control" ? "text-rose-600 font-mono text-sm" : "font-mono"}>{selectedQcForCa.level3}</strong>
                    </div>
                    <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 block">ผลตรวจซ้ำ:</span>
                      <span className="text-base font-extrabold font-mono text-slate-800 dark:text-white">
                        {existingCa.repeatLevel3 || "-"}
                      </span>
                      {existingCa.repeatLevel3 && (
                        <span className={`block text-[10px] font-extrabold mt-0.5 ${
                          repL3Status === "normal" ? "text-emerald-600" : "text-rose-600"
                        }`}>
                          {repL3Status === "normal" ? " In Control" : " Out of Control"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 Checklists Summary Grid */}
              <div className="space-y-2">
                <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs flex items-center space-x-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>ผลการทวนสอบเช็คลิสต์ 4 ด้าน:</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="font-medium text-slate-700 dark:text-slate-300">1. แผ่นตรวจ (Test Strip):</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                       ปกติ ไม่หมดอายุ
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="font-medium text-slate-700 dark:text-slate-300">2. น้ำยาควบคุม (Control):</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                       ปกติ ไม่หมดอายุ
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="font-medium text-slate-700 dark:text-slate-300">3. ระยะเวลาเปิดใช้ขวดน้ำยา:</span>
                    <span className="font-mono font-extrabold text-slate-800 dark:text-slate-200">
                      {existingCa.openDays !== undefined ? existingCa.openDays : (existingCa.controlOpenDays || 0)} วัน (เกณฑ์ ≤ 90 วัน)
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="font-medium text-slate-700 dark:text-slate-300">4. สภาพตัวเครื่อง / ช่องเสียบ:</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                       สะอาด ทำงานปกติ
                    </span>
                  </div>
                </div>
              </div>

              {/* Root Cause & Corrective Action Display */}
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 space-y-2.5">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-amber-800 dark:text-amber-400 block">สาเหตุของปัญหา (Root Cause):</span>
                  <p className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                    {existingCa.probableCause || "ไม่ได้ระบุสาเหตุ"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-amber-800 dark:text-amber-400 block">การดำเนินการแก้ไขและการป้องกัน (Corrective / Preventive Action):</span>
                  <p className="text-slate-700 dark:text-slate-200 text-xs whitespace-pre-wrap mt-0.5 font-medium">
                    {existingCa.correctiveActionNote || "ไม่มีหมายเหตุเพิ่มเติม"}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCaViewMode("edit")}
                  className="px-4 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950 dark:text-amber-300 font-extrabold text-xs cursor-pointer transition-all flex items-center space-x-1.5"
                >
                  <span>️ ปรับปรุงแก้ไขบันทึก (Edit)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCaModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs cursor-pointer transition-all"
                >
                  ปิดหน้าต่างรายงาน
                </button>
              </div>
            </div>
          ) : (
            /* EDIT / INPUT FORM VIEW */
            <form onSubmit={handleSaveCa} className="space-y-4">
              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs mb-1">1. การทวนสอบเช็คลิสต์ 4 ด้าน:</h4>
                <div className="space-y-2.5">
                  <label className="flex items-center space-x-2.5 cursor-pointer p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80">
                    <input
                      type="checkbox"
                      checked={caForm.stripExpNormal}
                      onChange={(e) => setCaForm({ ...caForm, stripExpNormal: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 dark:text-slate-300">แผ่นตรวจ (Test Strip) ปกติ (ไม่หมดอายุ / เก็บรักษาถูกต้อง)</span>
                  </label>

                  <label className="flex items-center space-x-2.5 cursor-pointer p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80">
                    <input
                      type="checkbox"
                      checked={caForm.controlExpNormal}
                      onChange={(e) => setCaForm({ ...caForm, controlExpNormal: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 dark:text-slate-300">น้ำยาควบคุม (Control Solution) ปกติ (ไม่หมดอายุ)</span>
                  </label>

                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px]">ระยะเวลาน้ำยาตั้งแต่เปิดใช้ (วัน):</label>
                    <input
                      type="number"
                      min="0"
                      max="365"
                      value={caForm.controlOpenDays ?? 0}
                      onChange={(e) => setCaForm({ ...caForm, controlOpenDays: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-xs"
                      placeholder="เช่น 15 วัน (กำหนดเปิดใช้ไม่เกิน 90 วัน)"
                    />
                  </div>

                  <label className="flex items-center space-x-2.5 cursor-pointer p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80">
                    <input
                      type="checkbox"
                      checked={caForm.machineConditionClean}
                      onChange={(e) => setCaForm({ ...caForm, machineConditionClean: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 dark:text-slate-300">สภาพตัวเครื่องและช่องใส่แถบตรวจสะอาด / ทำงานปกติ</span>
                  </label>
                </div>
              </div>

              {/* Repeat Test with Real-time In/Out Detection */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800 dark:text-slate-200">2. ผลการทดสอบซ้ำ (Repeat Test หลังแก้ไข):</label>
                  {isRepeatComplete && (
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      isRepeatAllIn 
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300" 
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 animate-pulse"
                    }`}>
                      {isRepeatAllIn ? " ผ่านเกณฑ์ In Control" : " ยังคง Out of Control"}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className={`p-2.5 rounded-xl border transition-all ${
                    repL1Status === "normal"
                      ? "bg-emerald-50/60 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-700"
                      : repL1Status === "out_of_control"
                        ? "bg-rose-50/60 border-rose-300 dark:bg-rose-950/30 dark:border-rose-700"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-500">Level 1 (Low)</span>
                      {repL1Status === "normal" && <span className="text-[9px] font-black text-emerald-600"> In</span>}
                      {repL1Status === "out_of_control" && <span className="text-[9px] font-black text-rose-600"> Out</span>}
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      value={caForm.repeatLevel1 || ""}
                      onChange={(e) => setCaForm({ ...caForm, repeatLevel1: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-xs"
                      placeholder="ค่าซ้ำ L1"
                    />
                    {caTargetLot && (
                      <span className="text-[9px] text-slate-400 block mt-1">เกณฑ์: {caTargetLot.level1Min} - {caTargetLot.level1Max}</span>
                    )}
                  </div>

                  <div className={`p-2.5 rounded-xl border transition-all ${
                    repL2Status === "normal"
                      ? "bg-emerald-50/60 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-700"
                      : repL2Status === "out_of_control"
                        ? "bg-rose-50/60 border-rose-300 dark:bg-rose-950/30 dark:border-rose-700"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-500">Level 2 (Normal)</span>
                      {repL2Status === "normal" && <span className="text-[9px] font-black text-emerald-600"> In</span>}
                      {repL2Status === "out_of_control" && <span className="text-[9px] font-black text-rose-600"> Out</span>}
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      value={caForm.repeatLevel2 || ""}
                      onChange={(e) => setCaForm({ ...caForm, repeatLevel2: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-xs"
                      placeholder="ค่าซ้ำ L2"
                    />
                    {caTargetLot && (
                      <span className="text-[9px] text-slate-400 block mt-1">เกณฑ์: {caTargetLot.level2Min} - {caTargetLot.level2Max}</span>
                    )}
                  </div>

                  <div className={`p-2.5 rounded-xl border transition-all ${
                    repL3Status === "normal"
                      ? "bg-emerald-50/60 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-700"
                      : repL3Status === "out_of_control"
                        ? "bg-rose-50/60 border-rose-300 dark:bg-rose-950/30 dark:border-rose-700"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-500">Level 3 (High)</span>
                      {repL3Status === "normal" && <span className="text-[9px] font-black text-emerald-600"> In</span>}
                      {repL3Status === "out_of_control" && <span className="text-[9px] font-black text-rose-600"> Out</span>}
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      value={caForm.repeatLevel3 || ""}
                      onChange={(e) => setCaForm({ ...caForm, repeatLevel3: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-xs"
                      placeholder="ค่าซ้ำ L3"
                    />
                    {caTargetLot && (
                      <span className="text-[9px] text-slate-400 block mt-1">เกณฑ์: {caTargetLot.level3Min} - {caTargetLot.level3Max}</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">3. สรุปสาเหตุที่น่าจะเป็นของความผิดปกติ (Probable Cause):</label>
                <select
                  value={caForm.probableCause || ""}
                  onChange={(e) => setCaForm({ ...caForm, probableCause: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-white"
                >
                  <option value="น้ำยาควบคุมเสื่อมสภาพ/หมดอายุ">น้ำยาควบคุมเสื่อมสภาพ / หมดอายุ / เปิดใช้นานเกินกำหนด</option>
                  <option value="แถบตรวจชื้นหรือเสื่อมสภาพ">แถบตรวจ (Test Strip) ชื้นหรือเสื่อมสภาพ</option>
                  <option value="ช่องใส่แถบตรวจสกปรก">ช่องใส่แถบตรวจ (Strip Holder) มีคราบสกปรก</option>
                  <option value="เทคนิคการปิเปตหรือหยดน้ำยาไม่ถูกต้อง">เทคนิคการหยดน้ำยาหรือการผสมไม่ถูกต้อง</option>
                  <option value="เครื่องวัดน้ำตาลผิดปกติ">ตัวเครื่องวัดน้ำตาลผิดปกติ / แบตเตอรี่อ่อน</option>
                  <option value="ปัจจัยอุณหภูมิสิ่งแวดล้อม">ปัจจัยอุณหภูมิ / ความชื้นในห้องตรวจ</option>
                  <option value="อื่นๆ">อื่นๆ (ระบุในหมายเหตุ)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">4. หมายเหตุ / การดำเนินการแก้ไข (Corrective Action Note):</label>
                <textarea
                  rows={3}
                  value={caForm.correctiveActionNote || ""}
                  onChange={(e) => setCaForm({ ...caForm, correctiveActionNote: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-white"
                  placeholder="ระบุรายละเอียดการแก้ไข เช่น เปลี่ยนขวดน้ำยาใหม่, ทำความสะอาดเครื่อง, ทดสอบซ้ำผ่านแล้ว..."
                />
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => existingCa ? setCaViewMode("report") : setIsCaModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <span>บันทึกผลการทวนสอบ (CA)</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" id="qc-management-redesigned">
      
      {/* Unified Clean Header & Navigation Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center justify-center font-black shrink-0 shadow-2xs">
              <Activity size={20} className="text-sky-600 dark:text-sky-300" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>ควบคุมคุณภาพภายใน (IQC POCT)</span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                  3 LEVELS
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                บันทึกและประเมินผล QC รายวัน พร้อมวิเคราะห์กราฟ Levey-Jennings และเปรียบเทียบระหว่างเครื่อง
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-bold text-slate-500 font-mono">
            <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              {qcRecords.length} ผลตรวจ
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              {machines.length} เครื่อง DTX
            </span>
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        <div className="sm:hidden w-full">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as QcTab)}
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer shadow-xs"
          >
            <option value="batch"> บันทึกผล QC</option>
            <option value="chart"> กราฟเดี่ยว LJ</option>
            <option value="comparison"> เปรียบเทียบกลุ่ม (Peer)</option>
            <option value="table"> ประวัติผลตรวจ</option>
            <option value="config">️ ตั้งค่า LOT</option>
          </select>
        </div>

        {/* Desktop Clean Segmented Tabs (Minimalist, Crisp & Modern) */}
        <div className="hidden sm:flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 w-full overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('batch')}
            className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
              activeTab === 'batch'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/50'
            }`}
          >
            <TableProperties size={14} className="shrink-0" />
            <span>บันทึกผล QC</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chart')}
            className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
              activeTab === 'chart'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/50'
            }`}
          >
            <BarChart3 size={14} className="shrink-0" />
            <span>กราฟเดี่ยว LJ</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('comparison')}
            className={`flex-1 min-w-[130px] py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
              activeTab === 'comparison'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/50'
            }`}
          >
            <TrendingUp size={14} className="shrink-0" />
            <span>เปรียบเทียบกลุ่ม (Peer)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
              activeTab === 'table'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/50'
            }`}
          >
            <FileSpreadsheet size={14} className="shrink-0" />
            <span>ประวัติผลตรวจ</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
              activeTab === 'config'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/50'
            }`}
          >
            <Settings size={14} className="shrink-0" />
            <span>ตั้งค่า LOT</span>
          </button>
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
                  <strong className="block font-black"> คำเตือน: Control {selectedLot} หมดอายุแล้ว!</strong>
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
                  <strong className="block font-bold">️ แจ้งเตือน: Control {selectedLot} ใกล้หมดอายุ</strong>
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
                      LAB
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
                      Ward
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
                            {cfg.lotNumber} {exp.status === 'expired' ? '( หมดอายุ)' : exp.status === 'critical' || exp.status === 'warning' ? `(️ เหลือ ${exp.daysRemaining} วัน)` : ''}
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
                  onClick={() => setActiveTab('table')}
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
                      LAB
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchScope('ward')}
                      className={`px-2.5 py-1 rounded-md transition-all ${batchScope === 'ward' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      Ward
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

            {!activeLotConfig && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between text-xs flex-wrap gap-2 text-amber-800 font-bold animate-fade-in">
                <span className="flex items-center gap-1.5">
                  <Info size={14} className="text-amber-600 shrink-0" />
                  <span>ยังไม่มีการตั้งค่าช่วงค่ามาตรฐานสำหรับ LOT {batchLot}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleStartConfigureStockLot(batchLot)}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  + ตั้งค่าช่วงค่า LOT นี้
                </button>
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
                        checked={paginatedBatchRows.length > 0 && paginatedBatchRows.every(r => r.selected)}
                        onChange={(e) => handleToggleSelectCurrentBatchPage(e.target.checked)}
                        className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                        title="เลือก/ยกเลิก ทั้งหมดในหน้านี้"
                      />
                    </th>
                    <th className="py-3 px-3.5 w-12 text-center">#</th>
                    <th className="py-2.5 px-2 w-28 whitespace-nowrap text-left">หน่วยงาน (Ward)</th>
                    <th className="py-2 px-2 font-mono w-32 text-left">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-sans font-bold text-slate-700 truncate">เครื่อง DTX</span>
                        <div className="flex items-center gap-0.5 font-sans text-[8px] bg-slate-200/90 p-0.5 rounded-md shrink-0 w-fit">
                          <button
                            type="button"
                            onClick={() => setMachineDisplayMode('code')}
                            className={`px-1 py-0.2 rounded font-extrabold cursor-pointer transition-all ${
                              machineDisplayMode === 'code' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="แสดงรหัสเครื่อง (CODE)"
                          >
                            CODE
                          </button>
                          <button
                            type="button"
                            onClick={() => setMachineDisplayMode('sn')}
                            className={`px-1 py-0.2 rounded font-extrabold cursor-pointer transition-all ${
                              machineDisplayMode === 'sn' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="แสดงหมายเลขซีเรียล (S/N)"
                          >
                            S/N
                          </button>
                          <button
                            type="button"
                            onClick={() => setMachineDisplayMode('both')}
                            className={`px-1 py-0.2 rounded font-extrabold cursor-pointer transition-all ${
                              machineDisplayMode === 'both' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="แสดงทั้งรหัส CODE และ S/N"
                          >
                            ทั้งคู่
                          </button>
                        </div>
                      </div>
                    </th>
                    <th className="py-3 px-3.5 text-center bg-emerald-50/50 text-emerald-900 w-36">
                      <div className="font-bold">Level 1 (Low)</div>
                      {activeLotConfig && (
                        <div className="text-[10px] font-mono text-emerald-700 font-black mt-0.5">
                          {activeLotConfig.level1Min} - {activeLotConfig.level1Max} mg/dL
                        </div>
                      )}
                    </th>
                    <th className="py-3 px-3.5 text-center bg-sky-50/50 text-sky-900 w-36">
                      <div className="font-bold">Level 2 (Normal)</div>
                      {activeLotConfig && (
                        <div className="text-[10px] font-mono text-sky-700 font-black mt-0.5">
                          {activeLotConfig.level2Min} - {activeLotConfig.level2Max} mg/dL
                        </div>
                      )}
                    </th>
                    <th className="py-3 px-3.5 text-center bg-purple-50/50 text-purple-900 w-36">
                      <div className="font-bold">Level 3 (High)</div>
                      {activeLotConfig && (
                        <div className="text-[10px] font-mono text-purple-700 font-black mt-0.5">
                          {activeLotConfig.level3Min} - {activeLotConfig.level3Max} mg/dL
                        </div>
                      )}
                    </th>
                    <th className="py-3 px-3.5 text-center w-28">สถานะประเมิน</th>
                  </tr>

                  {/* Header Column Filters Row */}
                  <tr className="bg-slate-100/90 border-b border-slate-200">
                    <td className="py-1.5 px-2 text-center text-[10px] text-slate-400 font-bold">กรอง:</td>
                    <td className="py-1.5 px-2 text-center text-[10px] text-slate-400 font-mono"></td>
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
                        <option value="in_control"> In Control</option>
                        <option value="out_control">️ Out Control</option>
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
                    paginatedBatchRows.map((row, idx) => {
                      const globalIdx = (batchPage - 1) * effectiveBatchPageSize + idx + 1;
                      const l1Status = evaluateValue(row.level1, activeLotConfig?.level1Min || 0, activeLotConfig?.level1Max || 0, activeLotConfig?.level1Target || 0, activeLotConfig?.level1SD || 1);
                      const l2Status = evaluateValue(row.level2, activeLotConfig?.level2Min || 0, activeLotConfig?.level2Max || 0, activeLotConfig?.level2Target || 0, activeLotConfig?.level2SD || 1);
                      const l3Status = evaluateValue(row.level3, activeLotConfig?.level3Min || 0, activeLotConfig?.level3Max || 0, activeLotConfig?.level3Target || 0, activeLotConfig?.level3SD || 1);
                      
                      const isComplete = row.level1.trim() && row.level2.trim() && row.level3.trim();
                      const hasOut = l1Status === 'out_of_control' || l2Status === 'out_of_control' || l3Status === 'out_of_control';

                      const isRowShaking = shakingSerials.includes(row.serialNumber);
                      const hasAnyInput = Boolean(row.level1.trim() || row.level2.trim() || row.level3.trim());

                      return (
                        <tr
                          key={row.serialNumber}
                          className={`transition-all ${
                            isRowShaking 
                              ? 'animate-shake bg-rose-50 ring-2 ring-rose-500 z-10 relative shadow-md' 
                              : !row.selected && !hasAnyInput 
                                ? 'bg-slate-50/40 opacity-60' 
                                : 'hover:bg-slate-50/70 bg-white'
                          }`}
                        >
                          <td className="py-2 px-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={() => handleToggleSelectRow(row.serialNumber)}
                              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-3.5 text-center text-slate-400 text-[11px] font-mono">{globalIdx}</td>
                          <td className="py-2 px-3.5 text-slate-900 font-bold">{row.ward}</td>
                          <td className="py-2 px-3.5 text-sky-800 font-mono font-bold" title={`CODE: ${row.serialNumber}`}>{formatMachineLabel(row.serialNumber)}</td>
                          
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

            {/* Bottom Submit Action Bar with Clean Minimalist Pagination */}
            <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 flex-wrap text-slate-600">
                <div>
                  แสดงเครื่องที่ <strong className="font-mono text-slate-800">{(batchPage - 1) * effectiveBatchPageSize + 1} - {Math.min(batchPage * effectiveBatchPageSize, filteredBatchRows.length)}</strong> จากทั้งหมด <strong className="font-mono text-slate-800">{filteredBatchRows.length}</strong> เครื่อง
                </div>
                <div className="text-slate-300">|</div>
                <div>
                  พร้อมบันทึก: <strong className="text-sky-700 font-mono font-bold">{batchRows.filter(r => r.selected && r.level1.trim() && r.level2.trim() && r.level3.trim()).length}</strong> จาก {batchRows.filter(r => r.selected).length} เครื่อง
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Page Size & Navigation */}
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1 text-slate-500 font-medium">
                    <span>แสดง:</span>
                    <CustomSelect
                      value={String(batchPageSize)}
                      onChange={(e) => {
                        setBatchPageSize(Number(e.target.value));
                        setBatchPage(1);
                      }}
                      className="text-xs py-1 px-2 rounded-lg border border-slate-200 bg-white font-bold text-slate-700"
                    >
                      <option value="10">10 เครื่อง</option>
                      <option value="15">15 เครื่อง</option>
                      <option value="20">20 เครื่อง</option>
                      <option value="0">ทั้งหมด ({filteredBatchRows.length})</option>
                    </CustomSelect>
                  </div>

                  {totalBatchPages > 1 && (
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        disabled={batchPage <= 1}
                        onClick={() => setBatchPage(p => Math.max(1, p - 1))}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 text-slate-700 cursor-pointer disabled:cursor-not-allowed transition-all"
                        title="หน้าก่อนหน้า"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 shadow-2xs font-mono">
                        {batchPage} / {totalBatchPages}
                      </span>
                      <button
                        type="button"
                        disabled={batchPage >= totalBatchPages}
                        onClick={() => setBatchPage(p => Math.min(totalBatchPages, p + 1))}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 text-slate-700 cursor-pointer disabled:cursor-not-allowed transition-all"
                        title="หน้าถัดไป"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>

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

      {/* VIEW 2: LEVEY-JENNINGS GRAPH VIEW */}
      {activeTab === 'chart' && (
        <div
          ref={chartContainerRef}
          className="space-y-6 bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/80 animate-fade-in relative"
        >
              {/* Floating Flank Stepper Navigation: Frosted Glass Arrows outside Content Area (Never overlaps sidebar & follows scroll) */}
              {filteredChartMachines.length > 1 && (
                <>
                  {/* Left Flank Button: Fixed at viewport center, follows scroll, never overlaps sidebar */}
                  <div
                    style={{
                      left: `${navPositions.leftX}px`,
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                    className={`fixed z-40 transition-opacity duration-200 ${
                      navPositions.visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={handlePrevMachine}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/90 dark:border-white/20 shadow-lg hover:shadow-xl hover:bg-white/95 dark:hover:bg-slate-800/95 text-slate-700 dark:text-slate-200 hover:text-sky-600 flex items-center justify-center hover:scale-110 active:scale-95 transition-all cursor-pointer"
                      title={`เครื่องก่อนหน้า: ${prevMachineObj?.serialNumber || ""} (หรือกดปุ่ม ← บนคีย์บอร์ด)`}
                    >
                      <ChevronLeft size={24} className="-ml-0.5" />
                    </button>
                  </div>

                  {/* Right Flank Button: Fixed at viewport center, follows scroll, stays outside right border */}
                  <div
                    style={{
                      left: `${navPositions.rightX}px`,
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                    className={`fixed z-40 transition-opacity duration-200 ${
                      navPositions.visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={handleNextMachine}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/90 dark:border-white/20 shadow-lg hover:shadow-xl hover:bg-white/95 dark:hover:bg-slate-800/95 text-slate-700 dark:text-slate-200 hover:text-sky-600 flex items-center justify-center hover:scale-110 active:scale-95 transition-all cursor-pointer"
                      title={`เครื่องถัดไป: ${nextMachineObj?.serialNumber || ""} (หรือกดปุ่ม → บนคีย์บอร์ด)`}
                    >
                      <ChevronRight size={24} className="-mr-0.5" />
                    </button>
                  </div>
                </>
              )}

              {/* Chart Filter Controls: Clean & Well-Organized Block (จัดเรียงเป็นระเบียบ) */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4 text-xs">
                {/* Block 1: Combo Selection (หน่วยงาน, เครื่องตรวจ, LOT แถบตรวจ) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {/* Filter 1: Ward */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1.5">
                      <Filter size={13} className="text-sky-600" />
                      <span>1. เลือกหน่วยงาน / วอร์ด</span>
                    </label>
                    <CustomSelect
                      value={chartFilterWard}
                      onChange={(e) => setChartFilterWard(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500 shadow-2xs"
                    >
                      <option value="">-- ทุกหน่วยงาน ({wards.length} หน่วยงาน) --</option>
                      {wards.map((w, idx) => (
                        <option key={idx} value={w.thai_name}>{w.thai_name}</option>
                      ))}
                    </CustomSelect>
                  </div>

                  {/* Filter 2: Machine */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Activity size={13} className="text-sky-600" />
                        <span>2. เลือกเครื่องตรวจ DTX</span>
                      </span>
                      {filteredChartMachines.length > 0 && (
                        <span className="text-[10px] font-mono text-slate-400 font-bold">
                          เครื่องที่ {currentMachineIndex + 1}/{filteredChartMachines.length}
                        </span>
                      )}
                    </label>
                    <CustomSelect
                      value={chartMachineSerial}
                      onChange={(e) => setChartMachineSerial(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-sky-300 bg-sky-50/70 font-bold text-sky-950 focus:ring-2 focus:ring-sky-500 shadow-2xs"
                    >
                      {filteredChartMachines.map((m) => (
                        <option key={m.serialNumber} value={m.serialNumber}>
                          เครื่อง {m.displayLabel} — ({m.ward})
                        </option>
                      ))}
                    </CustomSelect>
                  </div>

                  {/* Filter 3: LOT */}
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                    <label className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1.5">
                      <Layers size={13} className="text-sky-600" />
                      <span>3. LOT แถบตรวจ (ทางเลือก)</span>
                    </label>
                    <CustomSelect
                      value={chartSelectedLot}
                      onChange={(e) => setChartSelectedLot(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-slate-50 font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500 shadow-2xs"
                    >
                      <option value="all">-- ทุก LOT ที่เครื่องนี้ใช้ ({machineUsedLots.length}) --</option>
                      {machineUsedLots.map((lot) => (
                        <option key={lot} value={lot}>LOT {lot}</option>
                      ))}
                    </CustomSelect>
                  </div>
                </div>

                {/* Block 2: Time Range & Level Toggles (เรียงแถวที่ 2 สวยงาม ชัดเจน) */}
                <div className="pt-3.5 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Time Range Selector */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-extrabold text-slate-600 flex items-center gap-1.5">
                        <Calendar size={13} className="text-sky-600" />
                        <span>ช่วงเวลาที่ต้องการดู:</span>
                      </span>
                      {/* Presets */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {[
                          { id: "7days", label: "7 วันล่าสุด" },
                          { id: "15days", label: "15 วันล่าสุด" },
                          { id: "30days", label: "30 วันล่าสุด" },
                          { id: "this_month", label: "เดือนนี้" },
                          { id: "all", label: "ทั้งหมด" },
                        ].map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setRangePreset(p.id as any)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              chartTimeRangePreset === p.id
                                ? "bg-sky-600 text-white shadow-2xs"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* From - To Date Pickers */}
                    <div className="flex items-center gap-2 text-slate-500">
                      <span className="text-[11px] font-medium text-slate-400">ระบุวันที่:</span>
                      <input
                        type="date"
                        value={chartStartDate}
                        onChange={(e) => {
                          setChartStartDate(e.target.value);
                          setChartTimeRangePreset("custom");
                        }}
                        className="text-xs py-1 px-2.5 rounded-lg border border-slate-200 bg-slate-50 font-mono text-slate-700 focus:outline-none focus:border-sky-500"
                      />
                      <span className="text-slate-400">-</span>
                      <input
                        type="date"
                        value={chartEndDate}
                        onChange={(e) => {
                          setChartEndDate(e.target.value);
                          setChartTimeRangePreset("custom");
                        }}
                        className="text-xs py-1 px-2.5 rounded-lg border border-slate-200 bg-slate-50 font-mono text-slate-700 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  {/* Level Mode Selector */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
                    <span className="text-[11px] font-extrabold text-slate-600">ระดับที่แสดง:</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setSelectedChartLevel("all")}
                        className={`px-3 py-1.5 rounded-lg font-extrabold text-[11px] border cursor-pointer transition-all ${
                          selectedChartLevel === "all"
                            ? "bg-slate-800 text-white border-slate-800 shadow-2xs"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        แสดงครบ 3 ระดับ
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedChartLevel(1)}
                        className={`px-2.5 py-1.5 rounded-lg font-extrabold text-[11px] border cursor-pointer transition-all flex items-center space-x-1 ${
                          selectedChartLevel === 1
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                            : "bg-white text-emerald-800 border-slate-200 hover:bg-emerald-50"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Level 1</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedChartLevel(2)}
                        className={`px-2.5 py-1.5 rounded-lg font-extrabold text-[11px] border cursor-pointer transition-all flex items-center space-x-1 ${
                          selectedChartLevel === 2
                            ? "bg-sky-600 text-white border-sky-600 shadow-2xs"
                            : "bg-white text-sky-800 border-slate-200 hover:bg-sky-50"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-sky-500" />
                        <span>Level 2</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedChartLevel(3)}
                        className={`px-2.5 py-1.5 rounded-lg font-extrabold text-[11px] border cursor-pointer transition-all flex items-center space-x-1 ${
                          selectedChartLevel === 3
                            ? "bg-purple-600 text-white border-purple-600 shadow-2xs"
                            : "bg-white text-purple-800 border-slate-200 hover:bg-purple-50"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        <span>Level 3</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3 Level Stats Summary Cards with Explicit ±1SD, ±2SD, ±3SD Limits */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { lvl: 1 as const, title: "Level 1 (Low)", badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-200", stats: level1Stats, themeColor: "#10b981" },
                  { lvl: 2 as const, title: "Level 2 (Normal)", badgeBg: "bg-sky-50 text-sky-800 border-sky-200", stats: level2Stats, themeColor: "#0284c7" },
                  { lvl: 3 as const, title: "Level 3 (High)", badgeBg: "bg-purple-50 text-purple-800 border-purple-200", stats: level3Stats, themeColor: "#9333ea" }
                ].map(({ lvl, title, badgeBg, stats, themeColor }) => {
                  const target = stats.target || stats.mean;
                  const sd = stats.targetSD || stats.sd || 1;
                  const isSelected = selectedChartLevel === "all" || selectedChartLevel === lvl;

                  return (
                    <div
                      key={lvl}
                      onClick={() => setSelectedChartLevel(lvl)}
                      className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-sm space-y-3 ${
                        isSelected ? "border-slate-300 ring-2 ring-sky-500/20" : "border-slate-200/90 opacity-75 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-extrabold border px-2.5 py-0.5 rounded-md ${badgeBg}`}>
                          {title}
                        </span>
                        <div className="flex items-center space-x-1.5 font-mono text-[10px] text-slate-400">
                          <span>N = {stats.n}</span>
                          <span className="text-slate-300">•</span>
                          <span>LOT: {stats.lotRef}</span>
                        </div>
                      </div>

                      {/* Observed Metrics */}
                      <div className="grid grid-cols-3 gap-2 text-center py-1">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Mean (เป้าหมาย)</span>
                          <span className="text-sm font-extrabold text-slate-900 font-mono">
                            {stats.mean} <span className="text-[10px] text-slate-400 font-normal">({Math.round(target)})</span>
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">S.D. (ส่วนเบี่ยงเบน)</span>
                          <span className="text-sm font-extrabold text-slate-900 font-mono">{stats.sd}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">C.V.%</span>
                          <span className={`text-sm font-extrabold font-mono ${stats.cv > 8 ? "text-rose-600" : "text-emerald-600"}`}>
                            {stats.cv}%
                          </span>
                        </div>
                      </div>

                      {/* Explicit ±1SD, ±2SD, ±3SD Table */}
                      <div className="pt-2 border-t border-slate-100 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                          <span>ช่วงเกณฑ์ควบคุม (Control Limits):</span>
                          <span className="text-slate-400 font-mono">mg/dL</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-[10px] text-center font-mono">
                          <div className="p-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100/80">
                            <span className="text-[9px] block text-emerald-600 font-bold font-sans">±1 SD</span>
                            {(target - sd).toFixed(1)} - {(target + sd).toFixed(1)}
                          </div>
                          <div className="p-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/80">
                            <span className="text-[9px] block text-amber-600 font-bold font-sans">±2 SD (Warning)</span>
                            {(target - 2 * sd).toFixed(1)} - {(target + 2 * sd).toFixed(1)}
                          </div>
                          <div className="p-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200/80">
                            <span className="text-[9px] block text-rose-600 font-bold font-sans">±3 SD (Action)</span>
                            {(target - 3 * sd).toFixed(1)} - {(target + 3 * sd).toFixed(1)}
                          </div>
                        </div>
                      </div>

                      {/* Out of Control Warning Footer */}
                      <div className="text-[10px] pt-1.5 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-slate-400">หลุดเกณฑ์ 3SD:</span>
                        {stats.outOfControlCount > 0 ? (
                          <span className="text-rose-600 font-bold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                            {stats.outOfControlCount} ครั้ง (Out of Control)
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold">0 ครั้ง (ปกติ)</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* SVG Levey-Jennings Plots with Full ±1SD, ±2SD, ±3SD Lines & Zones */}
              {(() => {
                if (!chartMachineSerial) {
                  return (
                    <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                      <BarChart3 size={36} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-bold text-slate-600">กรุณาเลือกเครื่องตรวจที่ต้องการดูกราฟ Levey-Jennings</p>
                    </div>
                  );
                }

                if (machineChartRecords.length === 0) {
                  return (
                    <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                      <BarChart3 size={36} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-bold text-slate-600">
                        ไม่พบข้อมูลผลตรวจ QC ของเครื่อง {formatMachineLabel(chartMachineSerial)} ในช่วงเวลาที่เลือก
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        ช่วงเวลา: {dateRangeLabel} • ลองเปลี่ยนช่วงเวลาการดู หรือเลือกเครื่องตรวจอื่น
                      </p>
                    </div>
                  );
                }

                // Prepare configurations for active levels
                const allLevelConfigs = [
                  { level: 1 as const, title: "Level 1 (Low)", key: "L1", dataKey: "level1" as const, statusKey: "level1Status" as const, color: "#10b981", stats: level1Stats },
                  { level: 2 as const, title: "Level 2 (Normal)", key: "L2", dataKey: "level2" as const, statusKey: "level2Status" as const, color: "#0284c7", stats: level2Stats },
                  { level: 3 as const, title: "Level 3 (High)", key: "L3", dataKey: "level3" as const, statusKey: "level3Status" as const, color: "#9333ea", stats: level3Stats },
                ];

                const levelsToRender = selectedChartLevel === "all"
                  ? allLevelConfigs
                  : allLevelConfigs.filter(cfg => cfg.level === selectedChartLevel);

                const renderSingleLevelChart = (cfg: typeof allLevelConfigs[0]) => {
                  const target = cfg.stats.target || cfg.stats.mean;
                  const sd = cfg.stats.targetSD || cfg.stats.sd || 1;

                  // Values in records for this level
                  const recordValues = machineChartRecords
                    .map(r => Number(r[cfg.dataKey]))
                    .filter(v => !isNaN(v) && v > 0);

                  const rangeMin = Math.min(target - 3.8 * sd, ...recordValues);
                  const rangeMax = Math.max(target + 3.8 * sd, ...recordValues);

                  const width = 860;
                  const height = 300;
                  const paddingLeft = 75;
                  const paddingRight = 95;
                  const paddingTop = 25;
                  const paddingBottom = 40;
                  const plotWidth = width - paddingLeft - paddingRight;
                  const plotHeight = height - paddingTop - paddingBottom;

                  const getX = (idx: number) => {
                    if (machineChartRecords.length <= 1) return paddingLeft + plotWidth / 2;
                    return paddingLeft + (idx / (machineChartRecords.length - 1)) * plotWidth;
                  };

                  const getY = (val: number) => {
                    const fraction = (val - rangeMin) / (rangeMax - rangeMin);
                    return paddingTop + plotHeight - fraction * plotHeight;
                  };

                  // 7 reference lines: +3SD, +2SD, +1SD, Mean, -1SD, -2SD, -3SD
                  const refLines = [
                    { val: target + 3 * sd, label: "+3 SD (Action)", color: "#ef4444", strokeWidth: 1.5, strokeDash: "" },
                    { val: target + 2 * sd, label: "+2 SD (Warning)", color: "#f59e0b", strokeWidth: 1.2, strokeDash: "4,2" },
                    { val: target + 1 * sd, label: "+1 SD", color: "#94a3b8", strokeWidth: 1, strokeDash: "4,4" },
                    { val: target, label: "Mean (Target)", color: cfg.color, strokeWidth: 2, strokeDash: "" },
                    { val: target - 1 * sd, label: "-1 SD", color: "#94a3b8", strokeWidth: 1, strokeDash: "4,4" },
                    { val: target - 2 * sd, label: "-2 SD (Warning)", color: "#f59e0b", strokeWidth: 1.2, strokeDash: "4,2" },
                    { val: target - 3 * sd, label: "-3 SD (Action)", color: "#ef4444", strokeWidth: 1.5, strokeDash: "" },
                  ];

                  // Construct line path for data points
                  let pathD = "";
                  machineChartRecords.forEach((rec, idx) => {
                    const val = rec[cfg.dataKey];
                    const x = getX(idx);
                    const y = getY(val);
                    if (idx === 0) pathD = `M ${x} ${y}`;
                    else pathD += ` L ${x} ${y}`;
                  });

                  return (
                    <div key={cfg.level} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-3 relative">
                      {/* Sub-chart Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-slate-100 pb-2.5">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                          <h4 className="font-extrabold text-slate-800 text-sm">
                            {cfg.title} — เครื่อง {formatMachineLabel(chartMachineSerial)}
                          </h4>
                          {currentChartMachineObj?.ward && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-800">
                              {currentChartMachineObj.ward}
                            </span>
                          )}
                          <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            Mean: {Math.round(target)} | SD: {sd.toFixed(1)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                            ±2SD: {(target - 2 * sd).toFixed(1)} - {(target + 2 * sd).toFixed(1)}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                            ±3SD: {(target - 3 * sd).toFixed(1)} - {(target + 3 * sd).toFixed(1)}
                          </span>
                        </div>
                      </div>

                      {/* SVG Plot */}
                      <div className="overflow-x-auto">
                        <svg className="w-full min-w-[760px] h-76" viewBox={`0 0 ${width} ${height}`}>
                          {/* Plot Background */}
                          <rect x={paddingLeft} y={paddingTop} width={plotWidth} height={plotHeight} fill="#f8fafc" rx="8" />

                          {/* Shaded Control Zones */}
                          {/* In Control Zone (±2SD): Soft Green */}
                          <rect
                            x={paddingLeft}
                            y={getY(target + 2 * sd)}
                            width={plotWidth}
                            height={Math.max(0, getY(target - 2 * sd) - getY(target + 2 * sd))}
                            fill="#10b981"
                            fillOpacity="0.04"
                          />
                          {/* Warning Zone (+2SD to +3SD): Soft Amber */}
                          <rect
                            x={paddingLeft}
                            y={getY(target + 3 * sd)}
                            width={plotWidth}
                            height={Math.max(0, getY(target + 2 * sd) - getY(target + 3 * sd))}
                            fill="#f59e0b"
                            fillOpacity="0.07"
                          />
                          {/* Warning Zone (-2SD to -3SD): Soft Amber */}
                          <rect
                            x={paddingLeft}
                            y={getY(target - 2 * sd)}
                            width={plotWidth}
                            height={Math.max(0, getY(target - 3 * sd) - getY(target - 2 * sd))}
                            fill="#f59e0b"
                            fillOpacity="0.07"
                          />

                          {/* 7 Reference Lines: +3SD, +2SD, +1SD, Mean, -1SD, -2SD, -3SD */}
                          {refLines.map((line, idx) => {
                            const y = getY(line.val);
                            return (
                              <g key={idx}>
                                <line
                                  x1={paddingLeft}
                                  y1={y}
                                  x2={width - paddingRight}
                                  y2={y}
                                  stroke={line.color}
                                  strokeWidth={line.strokeWidth}
                                  strokeDasharray={line.strokeDash}
                                />
                                {/* Left Axis Number (Exact Value) */}
                                <text
                                  x={paddingLeft - 8}
                                  y={y + 3.5}
                                  textAnchor="end"
                                  fill={line.color}
                                  className="font-mono text-[9px] font-extrabold"
                                >
                                  {line.val.toFixed(1)}
                                </text>
                                {/* Right Axis Label */}
                                <text
                                  x={width - paddingRight + 6}
                                  y={y + 3.5}
                                  textAnchor="start"
                                  fill={line.color}
                                  className="font-bold text-[8.5px]"
                                >
                                  {line.label}
                                </text>
                              </g>
                            );
                          })}

                          {/* Connecting Path */}
                          <path
                            d={pathD}
                            fill="transparent"
                            stroke={cfg.color}
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />

                          {/* Data Points */}
                          {machineChartRecords.map((rec, idx) => {
                            const val = rec[cfg.dataKey];
                            const x = getX(idx);
                            const y = getY(val);
                            const diff = val - target;
                            const zScore = sd > 0 ? (diff / sd).toFixed(1) : "0.0";
                            const isOut = Math.abs(diff) > 3 * sd || rec[cfg.statusKey] === "out_of_control";
                            const isWarn = !isOut && Math.abs(diff) > 2 * sd;

                            const pointFill = isOut ? "#ef4444" : isWarn ? "#f59e0b" : cfg.color;
                            const pointRadius = isOut ? 6 : isWarn ? 5 : 4;
                            const isCurrentHovered = hoveredPoint && hoveredPoint.level === cfg.level && hoveredPoint.date === rec.date && hoveredPoint.val === val;

                            return (
                              <g
                                key={`pt-${idx}`}
                                className="cursor-pointer"
                                onMouseEnter={() => {
                                  setHoveredPoint({
                                    date: rec.date,
                                    ward: rec.ward,
                                    serial: rec.serialNumber,
                                    operator: rec.operator,
                                    level: cfg.level,
                                    val,
                                    target: Math.round(target),
                                    sd,
                                    status: isOut
                                      ? `Out of Control (หลุด 3SD | ${zScore} SD)`
                                      : isWarn
                                      ? `Warning (เตือน 2SD | ${zScore} SD)`
                                      : `In Control (ปกติ | ${zScore} SD)`,
                                    x,
                                    y,
                                    lot: rec.lotNumber
                                  });
                                }}
                                onMouseLeave={() => setHoveredPoint(null)}
                              >
                                {/* Invisible wide hit target (14px radius = 28px hit zone) to completely eliminate mouse jitter & flickering */}
                                <circle
                                  cx={x}
                                  cy={y}
                                  r={14}
                                  fill="transparent"
                                />
                                {/* Visible Data Point Circle without CSS scale transformation jitter */}
                                <circle
                                  cx={x}
                                  cy={y}
                                  r={isCurrentHovered ? pointRadius + 2.5 : pointRadius}
                                  fill={pointFill}
                                  stroke="#ffffff"
                                  strokeWidth={isCurrentHovered ? 2.5 : 1.5}
                                />
                                {/* Smooth outer highlight ring when hovered */}
                                {isCurrentHovered && (
                                  <circle
                                    cx={x}
                                    cy={y}
                                    r={pointRadius + 6}
                                    fill="none"
                                    stroke={pointFill}
                                    strokeWidth={1.5}
                                    strokeOpacity={0.6}
                                  />
                                )}
                              </g>
                            );
                          })}

                          {/* X-Axis Date Labels */}
                          {machineChartRecords.map((rec, idx) => {
                            if (machineChartRecords.length > 15 && idx % Math.ceil(machineChartRecords.length / 10) !== 0) {
                              return null;
                            }
                            const x = getX(idx);
                            const shortDate = rec.date.length >= 10 ? rec.date.substring(5, 10) : rec.date;
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
                    </div>
                  );
                };

                return (
                  <div className="space-y-4">
                    {levelsToRender.map(renderSingleLevelChart)}

                    {/* Floating Interactive Tooltip */}
                    {hoveredPoint && (
                      <div className="fixed bottom-6 right-6 bg-slate-900/95 backdrop-blur-xs text-white p-4 rounded-2xl shadow-2xl text-xs space-y-1.5 z-50 border border-slate-700 animate-fade-in max-w-sm pointer-events-none select-none">
                        <div className="font-extrabold flex items-center justify-between gap-4 border-b border-slate-700 pb-1.5">
                          <span className="text-emerald-300 font-bold">
                            Level {hoveredPoint.level} ({hoveredPoint.val} mg/dL)
                          </span>
                          <span
                            className={
                              hoveredPoint.status.includes("หลุด")
                                ? "text-rose-400 font-bold"
                                : hoveredPoint.status.includes("เตือน")
                                ? "text-amber-400 font-bold"
                                : "text-emerald-400 font-bold"
                            }
                          >
                            {hoveredPoint.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 space-y-1 pt-0.5 font-mono">
                          <div>เครื่อง: <strong className="text-white font-sans">{hoveredPoint.serial}</strong> ({hoveredPoint.ward})</div>
                          <div>วันที่: <strong className="text-white">{hoveredPoint.date}</strong></div>
                          {hoveredPoint.lot && <div>LOT: <strong className="text-amber-300">{hoveredPoint.lot}</strong></div>}
                          <div>ผู้ตรวจ: <strong className="text-white font-sans">{hoveredPoint.operator || "-"}</strong></div>
                          <div className="pt-1 border-t border-slate-800 text-[10px]">
                            เป้าหมาย Mean: <strong className="text-white">{hoveredPoint.target}</strong> | SD: <strong className="text-white">{hoveredPoint.sd.toFixed(1)}</strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
        </div>
      )}

      {/* VIEW 3: PEER GROUP COMPARISON VIEW */}
      {activeTab === 'comparison' && (
        <QCComparisonChart
          machines={machines}
          qcRecords={qcRecords}
          lotConfigs={lotConfigs}
          wards={wards}
          machineDisplayMode={machineDisplayMode}
          onSelectMachineForLJ={(serialNumber) => {
            setChartMachineSerial(serialNumber);
            setActiveTab('chart');
          }}
        />
      )}

      {/* VIEW 4: QC RECORDS HISTORY TABLE VIEW */}
      {activeTab === 'table' && (
        <div className="space-y-4 animate-fade-in" id="qc-history-table-section">
              {/* Table Filters & Actions */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center space-x-1 font-bold text-slate-700">
                    <Filter size={14} className="text-sky-600" />
                    <span>ตัวกรองตาราง:</span>
                  </div>

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
                      className="text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 font-semibold min-w-[120px]"
                    >
                      <option value="all">ทั้งหมด</option>
                      <option value="normal">ปกติ (In Control)</option>
                      <option value="out_of_control">หลุดเกณฑ์ (Out of Control)</option>
                    </CustomSelect>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-bold text-slate-500 font-mono">
                    พบทั้งหมด <strong className="text-sky-700">{tableRecords.length}</strong> รายการ
                  </span>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <Download size={14} />
                    <span>ส่งออก CSV</span>
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold">
                      <tr>
                        <th className="py-3 px-3.5 whitespace-nowrap">วันที่ตรวจ</th>
                        <th className="py-3 px-3.5">หน่วยงาน / วอร์ด</th>
                        <th className="py-3 px-3.5">เครื่องตรวจ (CODE)</th>
                        <th className="py-3 px-3.5">LOT แถบตรวจ</th>
                        <th className="py-3 px-3.5">ผู้ตรวจ</th>
                        <th className="py-3 px-3 text-center bg-emerald-50/50">Level 1 (Low)</th>
                        <th className="py-3 px-3 text-center bg-sky-50/50">Level 2 (Normal)</th>
                        <th className="py-3 px-3 text-center bg-purple-50/50">Level 3 (High)</th>
                        <th className="py-3 px-3.5 text-center">ผลภาพรวม</th>
                        <th className="py-3 px-3.5 text-center whitespace-nowrap">การจัดการ / CA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedQC.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-12 text-center text-slate-400">
                            <BarChart3 size={32} className="mx-auto text-slate-300 mb-2" />
                            <p className="font-bold text-slate-600">ไม่พบประวัติผลตรวจ IQC ตามเงื่อนไขที่เลือก</p>
                          </td>
                        </tr>
                      ) : (
                        paginatedQC.map((rec) => {
                          const isOut = rec.level1Status === "out_of_control" || rec.level2Status === "out_of_control" || rec.level3Status === "out_of_control";
                          const hasCa = !!rec.correctiveAction;

                          return (
                            <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-3.5 font-bold text-slate-700 whitespace-nowrap font-mono">{rec.date}</td>
                              <td className="py-3 px-3.5 text-slate-900 font-bold">{rec.ward}</td>
                              <td className="py-3 px-3.5 text-sky-800 font-mono font-bold" title={`CODE: ${rec.serialNumber}`}>
                                {formatMachineLabel(rec.serialNumber)}
                              </td>
                              <td className="py-3 px-3.5 text-slate-700 font-mono text-[11px] font-bold">
                                LOT {rec.lotNumber}
                              </td>
                              <td className="py-3 px-3.5 text-slate-700">{rec.operator}</td>

                              {/* Level 1 */}
                              <td className="py-2.5 px-3 text-center bg-emerald-50/20">
                                <span className={`font-mono font-bold ${rec.level1Status === "out_of_control" ? "text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200" : "text-emerald-700"}`}>
                                  {rec.level1}
                                </span>
                              </td>

                              {/* Level 2 */}
                              <td className="py-2.5 px-3 text-center bg-sky-50/20">
                                <span className={`font-mono font-bold ${rec.level2Status === "out_of_control" ? "text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200" : "text-sky-700"}`}>
                                  {rec.level2}
                                </span>
                              </td>

                              {/* Level 3 */}
                              <td className="py-2.5 px-3 text-center bg-purple-50/20">
                                <span className={`font-mono font-bold ${rec.level3Status === "out_of_control" ? "text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200" : "text-purple-700"}`}>
                                  {rec.level3}
                                </span>
                              </td>

                              {/* Overall Status */}
                              <td className="py-2.5 px-3.5 text-center">
                                {isOut ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                                    Out Control
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    In Control
                                  </span>
                                )}
                              </td>

                              {/* Action / CA */}
                              <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                                {isOut ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCaModal(rec)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-2xs ${
                                      hasCa
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                        : "bg-rose-600 hover:bg-rose-700 text-white"
                                    }`}
                                  >
                                    {hasCa ? " ดูรายงาน CA" : "! บันทึกทวนสอบ (CA)"}
                                  </button>
                                ) : (
                                  <span className="text-slate-300 text-[11px]">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                  <div className="flex items-center space-x-2">
                    <span>
                      {tableRecords.length > 0 ? (
                        <>
                          แสดง <strong className="font-mono text-slate-800 font-bold">{((currentPage - 1) * itemsPerPage) + 1}</strong> - <strong className="font-mono text-slate-800 font-bold">{Math.min(currentPage * itemsPerPage, tableRecords.length)}</strong> จากทั้งหมด <strong className="font-mono text-sky-700 font-bold">{tableRecords.length}</strong> รายการ
                        </>
                      ) : (
                        "ยังไม่มีข้อมูลบันทึก"
                      )}
                    </span>
                    <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-300">
                      <span className="text-[11px] text-slate-400">แสดงหน้าละ:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="text-xs py-1 px-2 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 cursor-pointer"
                      >
                        <option value={5}>5 รายการ</option>
                        <option value={10}>10 รายการ</option>
                        <option value={20}>20 รายการ</option>
                        <option value={50}>50 รายการ</option>
                      </select>
                    </div>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                        title="หน้าแรก"
                      >
                        <ChevronsLeft size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                        title="หน้าก่อนหน้า"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 shadow-2xs font-mono">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                        title="หน้าถัดไป"
                      >
                        <ChevronRight size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                        title="หน้าสุดท้าย"
                      >
                        <ChevronsRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
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
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-md hover:shadow-lg transition-all"
                >
                  <Plus size={15} />
                  <span>เพิ่ม LOT / ตั้งค่า Target ใหม่</span>
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
                  ️ ตั้งค่า LOT แรกที่รอดำเนินการ
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
                               ตั้งค่าแล้ว
                            </span>
                          ) : (
                            <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded animate-pulse">
                               รอตั้งค่า Target
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
                          <span className="text-emerald-800 font-mono font-black">
                            ช่วงค่า: {cfg.level1Min} - {cfg.level1Max} mg/dL
                          </span>
                        </div>

                        {/* Level 2 */}
                        <div className="p-2 bg-sky-50/50 rounded-xl border border-sky-100 flex items-center justify-between text-[11px]">
                          <span className="font-extrabold text-sky-900">L2 (Normal)</span>
                          <span className="text-sky-800 font-mono font-black">
                            ช่วงค่า: {cfg.level2Min} - {cfg.level2Max} mg/dL
                          </span>
                        </div>

                        {/* Level 3 */}
                        <div className="p-2 bg-purple-50/50 rounded-xl border border-purple-100 flex items-center justify-between text-[11px]">
                          <span className="font-extrabold text-purple-900">L3 (High)</span>
                          <span className="text-purple-800 font-mono font-black">
                            ช่วงค่า: {cfg.level3Min} - {cfg.level3Max} mg/dL
                          </span>
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

          {/* Edit / Configure Lot Modal (QuickWin Matched UI/UX - Pinned Header & Footer) */}
          {editingLotIdx !== null && editedLot && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in no-print overflow-hidden">
              <div className="bg-white dark:bg-slate-900 w-full max-w-xl sm:max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[88vh] sm:max-h-[90vh] overflow-hidden my-auto">
                
                {/* Modal Header - Fixed */}
                <div className="px-5 py-3.5 sm:px-6 sm:py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0 shadow-xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center font-bold shrink-0">
                      <Layers size={20} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-extrabold leading-tight">
                        {editedLot.lotNumber ? `ตั้งค่าช่วงมาตรฐาน LOT ${editedLot.lotNumber}` : 'เพิ่ม LOT ควบคุมคุณภาพ & Strip ใหม่'}
                      </h3>
                      <p className="text-[11px] sm:text-xs text-emerald-100 font-medium">
                        กำหนดเลข LOT, วันหมดอายุ (EXP), และช่วงค่าควบคุม (Range Control L1, L2, L3)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLotIdx(null);
                      setEditedLot(null);
                    }}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
                    title="ปิด"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Modal Form Container */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveLotConfig();
                  }} 
                  className="flex-1 min-h-0 flex flex-col overflow-hidden"
                >
                  {/* Scrollable Content Body */}
                  <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-3.5 text-xs">
                    
                    {/* Section 1: Basic LOT Details */}
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5 text-xs">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span>1. ข้อมูลทั่วไปของ LOT (Basic Details)</span>
                        </h4>
                        {stockLots.length > 0 && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            (มี {stockLots.length} LOT ในคลังพัสดุ)
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                        <div className="flex flex-col justify-between space-y-1">
                          <label className="font-bold text-slate-700 dark:text-slate-300 text-[11px] truncate">
                            เลข LOT (LOT Number) <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            list="admin-stock-lots-datalist"
                            value={editedLot.lotNumber}
                            onChange={(e) => {
                              const selectedVal = e.target.value.toUpperCase();
                              const matchedStock = stockLots.find(s => s.lotNumber.toUpperCase() === selectedVal);
                              const matchedConfig = lotConfigs.find(l => l.lotNumber.toUpperCase() === selectedVal);
                              
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
                              } else {
                                setEditedLot({ ...editedLot, lotNumber: selectedVal });
                              }
                            }}
                            placeholder="เช่น 261122 หรือ LOT2026-B"
                            className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none uppercase font-mono text-xs"
                          />
                          <datalist id="admin-stock-lots-datalist">
                            {stockLots.map((sl, i) => (
                              <option key={i} value={sl.lotNumber}>
                                {sl.lotNumber} ({sl.itemType === 'control_solution' ? 'น้ำยา QC' : 'Strip'}) {sl.expDate ? `EXP: ${sl.expDate}` : ''}
                              </option>
                            ))}
                          </datalist>
                        </div>

                        <div className="flex flex-col justify-between space-y-1">
                          <label className="font-bold text-slate-700 dark:text-slate-300 text-[11px] truncate">
                            วันหมดอายุ (EXP Date) <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={editedLot.expDate || ''}
                            onChange={(e) => setEditedLot({ ...editedLot, expDate: e.target.value })}
                            className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-xs"
                          />
                        </div>

                        <div className="flex flex-col justify-between space-y-1">
                          <label className="font-bold text-slate-700 dark:text-slate-300 text-[11px] truncate" title="บริษัท / ผู้ผลิต (Manufacturer)">
                            ผู้ผลิต (Manufacturer)
                          </label>
                          <input
                            type="text"
                            value={editedLot.manufacturer || ''}
                            onChange={(e) => setEditedLot({ ...editedLot, manufacturer: e.target.value })}
                            placeholder="เช่น VivaChek Fad, Roche"
                            className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Range Control (L1, L2, L3) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5 text-xs">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span>2. ช่วงค่าควบคุมมาตรฐาน (Standard Range Control)</span>
                        </h4>
                        <span className="text-[10px] text-slate-400 font-medium">หน่วย: mg/dL</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        
                        {/* Level 1 (Low) */}
                        <div className="bg-emerald-50/60 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 space-y-2.5">
                          <div className="flex items-center justify-between pb-1 border-b border-emerald-200 dark:border-emerald-800/60">
                            <span className="font-black text-emerald-800 dark:text-emerald-300 text-xs">Level 1 (Low)</span>
                            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold">ต่ำ</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-0.5">
                              <label className="font-bold text-slate-600 dark:text-slate-300 text-[10px]">Min (ต่ำสุด)</label>
                              <input
                                type="number"
                                step="any"
                                required
                                placeholder="21"
                                value={editedLot.level1Min ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : Number(e.target.value);
                                  updateLevelValues(1, 'min', val);
                                }}
                                className="w-full p-2 rounded-xl border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-slate-900 font-black text-emerald-800 dark:text-emerald-300 text-center font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                              />
                            </div>
                            <div className="space-y-0.5">
                              <label className="font-bold text-slate-600 dark:text-slate-300 text-[10px]">Max (สูงสุด)</label>
                              <input
                                type="number"
                                step="any"
                                required
                                placeholder="51"
                                value={editedLot.level1Max ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : Number(e.target.value);
                                  updateLevelValues(1, 'max', val);
                                }}
                                className="w-full p-2 rounded-xl border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-slate-900 font-black text-emerald-800 dark:text-emerald-300 text-center font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="bg-emerald-100/70 dark:bg-emerald-900/50 py-1.5 px-2 rounded-xl text-center text-[11px] font-mono font-black text-emerald-800 dark:text-emerald-200">
                            ช่วงค่า: {editedLot.level1Min || 0} - {editedLot.level1Max || 0} mg/dL
                          </div>
                        </div>

                        {/* Level 2 (Normal) */}
                        <div className="bg-sky-50/60 dark:bg-sky-950/40 p-3 rounded-2xl border border-sky-200 dark:border-sky-800/80 space-y-2.5">
                          <div className="flex items-center justify-between pb-1 border-b border-sky-200 dark:border-sky-800/60">
                            <span className="font-black text-sky-800 dark:text-sky-300 text-xs">Level 2 (Normal)</span>
                            <span className="text-[10px] bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded font-bold">ปกติ</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-0.5">
                              <label className="font-bold text-slate-600 dark:text-slate-300 text-[10px]">Min (ต่ำสุด)</label>
                              <input
                                type="number"
                                step="any"
                                required
                                placeholder="89"
                                value={editedLot.level2Min ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : Number(e.target.value);
                                  updateLevelValues(2, 'min', val);
                                }}
                                className="w-full p-2 rounded-xl border border-sky-200 dark:border-sky-700 bg-white dark:bg-slate-900 font-black text-sky-800 dark:text-sky-300 text-center font-mono text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                              />
                            </div>
                            <div className="space-y-0.5">
                              <label className="font-bold text-slate-600 dark:text-slate-300 text-[10px]">Max (สูงสุด)</label>
                              <input
                                type="number"
                                step="any"
                                required
                                placeholder="133"
                                value={editedLot.level2Max ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : Number(e.target.value);
                                  updateLevelValues(2, 'max', val);
                                }}
                                className="w-full p-2 rounded-xl border border-sky-200 dark:border-sky-700 bg-white dark:bg-slate-900 font-black text-sky-800 dark:text-sky-300 text-center font-mono text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="bg-sky-100/70 dark:bg-sky-900/50 py-1.5 px-2 rounded-xl text-center text-[11px] font-mono font-black text-sky-800 dark:text-sky-200">
                            ช่วงค่า: {editedLot.level2Min || 0} - {editedLot.level2Max || 0} mg/dL
                          </div>
                        </div>

                        {/* Level 3 (High) */}
                        <div className="bg-purple-50/60 dark:bg-purple-950/40 p-3 rounded-2xl border border-purple-200 dark:border-purple-800/80 space-y-2.5">
                          <div className="flex items-center justify-between pb-1 border-b border-purple-200 dark:border-purple-800/60">
                            <span className="font-black text-purple-800 dark:text-purple-300 text-xs">Level 3 (High)</span>
                            <span className="text-[10px] bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded font-bold">สูง</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-0.5">
                              <label className="font-bold text-slate-600 dark:text-slate-300 text-[10px]">Min (ต่ำสุด)</label>
                              <input
                                type="number"
                                step="any"
                                required
                                placeholder="261"
                                value={editedLot.level3Min ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : Number(e.target.value);
                                  updateLevelValues(3, 'min', val);
                                }}
                                className="w-full p-2 rounded-xl border border-purple-200 dark:border-purple-700 bg-white dark:bg-slate-900 font-black text-purple-800 dark:text-purple-300 text-center font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                              />
                            </div>
                            <div className="space-y-0.5">
                              <label className="font-bold text-slate-600 dark:text-slate-300 text-[10px]">Max (สูงสุด)</label>
                              <input
                                type="number"
                                step="any"
                                required
                                placeholder="392"
                                value={editedLot.level3Max ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : Number(e.target.value);
                                  updateLevelValues(3, 'max', val);
                                }}
                                className="w-full p-2 rounded-xl border border-purple-200 dark:border-purple-700 bg-white dark:bg-slate-900 font-black text-purple-800 dark:text-purple-300 text-center font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="bg-purple-100/70 dark:bg-purple-900/50 py-1.5 px-2 rounded-xl text-center text-[11px] font-mono font-black text-purple-800 dark:text-purple-200">
                            ช่วงค่า: {editedLot.level3Min || 0} - {editedLot.level3Max || 0} mg/dL
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Section 3: Notes (Optional) */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600 dark:text-slate-400 text-[11px]">หมายเหตุเพิ่มเติม (Optional Notes)</label>
                      <input
                        type="text"
                        value={editedLot.notes || ''}
                        onChange={(e) => setEditedLot({ ...editedLot, notes: e.target.value })}
                        placeholder="เช่น ล็อตใหม่ประจำไตรมาสสำหรับงานชันสูตร"
                        className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
                      />
                    </div>

                  </div>

                  {/* Modal Footer Buttons - Fixed at Bottom */}
                  <div className="px-5 py-3 sm:px-6 sm:py-3.5 bg-slate-50 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2.5 shrink-0 z-10">
                    {role === 'admin' && editedLot.lotNumber && editedLot.lotNumber.trim().length > 0 ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteLotConfig(editedLot.lotNumber)}
                        className="px-3.5 py-2 rounded-xl text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                        <span>ลบ LOT นี้</span>
                      </button>
                    ) : (
                      <div></div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isSavingLot}
                        onClick={() => {
                          setEditingLotIdx(null);
                          setEditedLot(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingLot}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md hover:shadow-lg transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingLot ? (
                          <>
                            <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                            <span>กำลังบันทึก...</span>
                          </>
                        ) : (
                          <>
                            <Check size={15} />
                            <span>บันทึก LOT ใหม่</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                </form>

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
                 ยกเลิก (เพื่อเปลี่ยนขวดน้ำยาใหม่)
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

      {renderCaModal()}
    </div>
  );
}