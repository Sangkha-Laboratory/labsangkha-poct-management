/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  QcLotConfig, 
  StripReagentItem, 
  DtxMachine, 
  SupplyRequest, 
  BatteryDisbursementRecord 
} from '../types';
import { dbService, generateUUID } from '../lib/supabase';
import { getThaiTodayDateOnly, formatThaiDateOnly } from '../lib/dateUtils';
import { BarcodePrinterModal } from './BarcodePrinterModal';
import JsBarcode from 'jsbarcode';
import { 
  Package, Search, Filter, Layers, Clock, AlertTriangle, 
  CheckCircle2, Barcode, Sparkles, Droplet, FlaskConical, 
  Calendar, Building2, User, ChevronRight, RefreshCw, FileText,
  Plus, Edit2, Trash2, X, SlidersHorizontal, Calculator, Save, Info, Zap,
  Table as TableIcon, LayoutGrid, Printer, Download, Battery, BatteryCharging,
  QrCode, Check, ArrowRight, History, ShieldCheck, Box, CheckCircle, Smartphone
} from 'lucide-react';

interface StripReagentStockProps {
  lotConfigs: QcLotConfig[];
  supplies?: SupplyRequest[];
  machines?: DtxMachine[];
  onUpdateLotConfigs?: (configs: QcLotConfig[]) => void;
  onAddMachine?: (machine: DtxMachine) => void;
  onUpdateMachine?: (machine: DtxMachine) => void;
  onDeleteMachine?: (id: string) => void;
  onDeleteSupply?: (id: string) => void;
  onBulkAddMachines?: (machines: DtxMachine[], overwrite?: boolean) => Promise<{ success: number; failed: number }>;
}

// Unified History Item Interface for combined history table
interface UnifiedHistoryItem {
  id: string;
  category: 'battery' | 'strip' | 'machine' | 'lancet' | 'control_solution' | 'other';
  categoryLabel: string;
  date: string;
  ward: string;
  itemDetails: string;
  quantity: string;
  requester: string;
  dispenser: string;
  status: 'approved' | 'dispensed' | 'pending' | 'rejected';
  reasonOrNotes?: string;
  isBatteryRecord?: boolean;
}

// 100% Compliant Code 128 Barcode Vector Renderer
function Code128Barcode({ 
  text, 
  height = 28, 
  barWidth = 1.25,
  showText = true,
  className = ''
}: { 
  text: string; 
  height?: number; 
  barWidth?: number; 
  showText?: boolean;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && text) {
      try {
        JsBarcode(svgRef.current, text, {
          format: "CODE128",
          lineColor: "#000000",
          background: "#ffffff",
          width: barWidth,
          height: height,
          displayValue: false,
          margin: 0,
          marginLeft: 8,
          marginRight: 8,
          marginTop: 1,
          marginBottom: 1
        });
        if (svgRef.current) {
          svgRef.current.setAttribute("shape-rendering", "crispEdges");
          const rects = svgRef.current.querySelectorAll("rect");
          rects.forEach(r => r.setAttribute("shape-rendering", "crispEdges"));
        }
      } catch (err) {
        console.error('JsBarcode render error:', err);
      }
    }
  }, [text, height, barWidth]);

  return (
    <div className={`inline-flex flex-col items-center bg-white p-1 rounded-lg border border-slate-200 select-none shadow-2xs ${className}`}>
      <svg ref={svgRef} className="max-w-full block" style={{ shapeRendering: 'crispEdges' }} />
      {showText && (
        <span className="font-mono text-[9px] font-black text-slate-900 tracking-wider mt-0.5 leading-none">
          {text}
        </span>
      )}
    </div>
  );
}

export default function StripReagentStock({
  lotConfigs,
  supplies = [],
  machines = [],
  onUpdateLotConfigs,
  onDeleteSupply
}: StripReagentStockProps) {
  // Sub-Navigation Tabs: 'stock' (คลัง) | 'history' (ประวัติเบิก)
  const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in_stock' | 'in_use' | 'depleted'>('all');

  // Multi-select & History Modal state
  const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Local supplies state to reflect deletions instantly
  const [localSupplies, setLocalSupplies] = useState<SupplyRequest[]>(supplies);
  useEffect(() => {
    setLocalSupplies(supplies);
  }, [supplies]);

  // Universal In-App Confirmation Modal State (Fixes iframe sandbox blocking window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    confirmButtonClass?: string;
    isLoading?: boolean;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'ยืนยัน',
    onConfirm: () => {}
  });

  // Database Items State (Zero Mock Data, Strictly Supabase)
  const [items, setItems] = useState<StripReagentItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Unified Search & Barcode Scan Input (Single Input for both scanning and real-time searching)
  const [searchOrScanCode, setSearchOrScanCode] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'strip' | 'control_solution' | 'battery'>('all');
  const [filterLot, setFilterLot] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  // Modals & Notifications
  const [toastMsg, setToastMsg] = useState<string>('');
  const [editingItem, setEditingItem] = useState<StripReagentItem | null>(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isBarcodePrinterOpen, setIsBarcodePrinterOpen] = useState(false);
  const [selectedItemForPrint, setSelectedItemForPrint] = useState<string | undefined>(undefined);
  const [selectedLotForPrint, setSelectedLotForPrint] = useState<string | undefined>(undefined);

  // Bulk Selection Handlers
  const handleSelectAllStockItems = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedStockIds(filteredStockItems.map(i => i.id));
    } else {
      setSelectedStockIds([]);
    }
  };

  const handleToggleSelectStockItem = (id: string) => {
    setSelectedStockIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkOpenForUse = () => {
    const targets = items.filter(i => selectedStockIds.includes(i.id) && i.status === 'in_stock');
    if (targets.length === 0) {
      showToast('ไม่มีรายการที่อยู่ในสถานะ "ยังไม่เปิดฝา" ในกลุ่มที่เลือก');
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันเปิดใช้งานพัสดุพร้อมกัน',
      description: `คุณต้องการเปิดใช้งานพัสดุจำนวน ${targets.length} รายการพร้อมกันในวันนี้ใช่หรือไม่?`,
      confirmText: `เปิดใช้งาน ${targets.length} รายการ`,
      confirmButtonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      onConfirm: async () => {
        try {
          setConfirmDialog(prev => ({ ...prev, isLoading: true }));
          const today = getThaiTodayDateOnly();
          const openExpDays = 90;
          const [y, m, d] = today.split('-').map(Number);
          const expObj = new Date(y, m - 1, d + openExpDays);
          const expDateStr = `${expObj.getFullYear()}-${String(expObj.getMonth() + 1).padStart(2, '0')}-${String(expObj.getDate()).padStart(2, '0')}`;

          await Promise.all(targets.map(item => 
            dbService.updateStripReagentItem(item.id, {
              status: 'in_use',
              openDate: today,
              openExpDate: expDateStr,
              openedBy: 'เจ้าหน้าที่ห้องแล็บ'
            })
          ));
          await loadItems();
          setSelectedStockIds([]);
          showToast(`เปิดใช้งานพัสดุ ${targets.length} รายการเรียบร้อยแล้ว`);
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (err: any) {
          showToast(`เกิดข้อผิดพลาดในการเปิดใช้งาน: ${err?.message || err}`);
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  const handleBulkMarkDepleted = () => {
    const targets = items.filter(i => selectedStockIds.includes(i.id) && (i.status === 'in_use' || i.status === 'in_stock'));
    if (targets.length === 0) {
      showToast('ไม่มีรายการที่สามารถบันทึกใช้งานหมดได้');
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันตัดยอดพัสดุใช้งานหมด',
      description: `คุณต้องการบันทึกตัดยอดพัสดุใช้งานหมดจำนวน ${targets.length} รายการใช่หรือไม่?`,
      confirmText: `บันทึกใช้หมด ${targets.length} รายการ`,
      confirmButtonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
      onConfirm: async () => {
        try {
          setConfirmDialog(prev => ({ ...prev, isLoading: true }));
          await Promise.all(targets.map(item => 
            dbService.updateStripReagentItem(item.id, {
              status: 'depleted',
              notes: (item.notes ? item.notes + ' ' : '') + `[ใช้หมดเมื่อ ${getThaiTodayDateOnly()}]`
            })
          ));
          await loadItems();
          setSelectedStockIds([]);
          showToast(`บันทึกตัดยอดพัสดุใช้งานหมด ${targets.length} รายการเรียบร้อยแล้ว`);
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (err: any) {
          showToast(`เกิดข้อผิดพลาด: ${err?.message || err}`);
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  const handleBulkDeleteItems = () => {
    if (selectedStockIds.length === 0) return;
    const count = selectedStockIds.length;
    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันลบรายการพัสดุที่เลือก',
      description: `คุณต้องการลบพัสดุที่เลือกจำนวน ${count} รายการออกจากฐานข้อมูลทั้งหมดใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`,
      confirmText: `ยืนยันลบ ${count} รายการ`,
      confirmButtonClass: 'bg-rose-600 hover:bg-rose-700 text-white',
      onConfirm: async () => {
        try {
          setConfirmDialog(prev => ({ ...prev, isLoading: true }));
          const targets = [...selectedStockIds];
          const targetItems = items.filter(i => targets.includes(i.id));
          setItems(prev => prev.filter(i => !targets.includes(i.id)));
          setSelectedStockIds([]);

          await Promise.all(targetItems.map(item => dbService.deleteStripReagentItem(item.id, item.itemCode)));
          await loadItems();
          showToast(`ลบพัสดุ ${targets.length} รายการเรียบร้อยแล้ว`);
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (err: any) {
          showToast(`เกิดข้อผิดพลาดในการลบ: ${err?.message || err}`);
          await loadItems();
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  // Battery Disbursement State
  const [batteryDisbursements, setBatteryDisbursements] = useState<BatteryDisbursementRecord[]>([]);
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);

  // History Filter State for Tab 2
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<'all' | 'battery' | 'strip' | 'machine' | 'lancet' | 'control_solution'>('all');

  const initialDisburseForm = {
    ward: 'งานชันสูตรสาธารณสุข',
    bgmCode: '',
    serialNumber: '',
    batteryType: 'AAA' as 'AAA' | 'AA' | 'CR2032' | 'other',
    quantity: 2,
    requesterName: '',
    dispenserName: 'เจ้าหน้าที่ห้องแล็บ',
    reason: 'ถ่านหมด/เปลี่ยนถ่านประจำเครื่อง',
    notes: ''
  };
  const [disburseForm, setDisburseForm] = useState(initialDisburseForm);

  // Wards List from Supabase
  const [wards, setWards] = useState<{ en_name: string; thai_name: string }[]>([]);

  // Inbound Receive Form State
  const initialReceiveForm = {
    category: 'strip' as 'strip' | 'control_solution' | 'battery',
    lotNumber: '',
    manufacturer: 'VivaChek Fad',
    boxCount: 5,
    testsPerBox: 50,
    receivedDate: getThaiTodayDateOnly(),
    expDate: '',
    openExpDays: 90,
    notes: '',
    level1Target: 45,
    level1Min: 35,
    level1Max: 55,
    level1SD: 5,
    level2Target: 120,
    level2Min: 100,
    level2Max: 140,
    level2SD: 10,
    level3Target: 300,
    level3Min: 260,
    level3Max: 340,
    level3SD: 20
  };
  const [receiveForm, setReceiveForm] = useState(initialReceiveForm);
  const [isSubmittingReceive, setIsSubmittingReceive] = useState(false);

  // Show Toast
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // 1. Load Items from Supabase (Zero localStorage)
  const loadItems = async () => {
    setIsLoadingItems(true);
    try {
      const dbItems = await dbService.getStripReagentItems();
      if (Array.isArray(dbItems)) {
        setItems(dbItems);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.warn('Error loading strip items from database:', err);
      setItems([]);
    } finally {
      setIsLoadingItems(false);
    }
  };

  // 2. Load Battery Disbursements
  const loadBatteryData = async () => {
    try {
      const list = await dbService.getBatteryDisbursements();
      if (Array.isArray(list)) {
        setBatteryDisbursements(list);
      } else {
        setBatteryDisbursements([]);
      }
    } catch (err) {
      console.warn('Error loading battery disbursements:', err);
      setBatteryDisbursements([]);
    }
  };

  useEffect(() => {
    loadItems();
    loadBatteryData();
    dbService.getWards().then(setWards).catch(console.error);
  }, []);

  // Exact Match Scan Result Item
  const scanExactMatchedItem = useMemo(() => {
    const q = searchOrScanCode.trim().toUpperCase();
    if (!q) return null;
    return items.find(i => 
      i.itemCode.toUpperCase() === q || 
      i.lotNumber.toUpperCase() === q
    ) || null;
  }, [items, searchOrScanCode]);

  // Handle Barcode Scanner Form Submit
  const handleSingleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (scanExactMatchedItem) {
      showToast(`พบรหัสพัสดุ: ${scanExactMatchedItem.itemCode} (LOT: ${scanExactMatchedItem.lotNumber})`);
    } else if (searchOrScanCode.trim()) {
      showToast(`กรองผลลัพธ์ด้วยคำค้น "${searchOrScanCode.trim()}"`);
    }
  };

  // Handle Barcode Scanner for Disbursement (in History Tab)
  const handleDisburseScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = historySearchTerm.trim().toUpperCase();
    if (!code) return;

    // 1. Search in machine serial numbers (CODE BGM / machineSerial)
    const matchedMachine = machines.find(m => 
      m.serialNumber.toUpperCase() === code || 
      (m.machineSerial && m.machineSerial.toUpperCase() === code)
    );

    if (matchedMachine) {
      setDisburseForm(prev => ({
        ...prev,
        bgmCode: matchedMachine.serialNumber,
        serialNumber: matchedMachine.machineSerial || matchedMachine.serialNumber,
        ward: matchedMachine.ward || prev.ward
      }));
      setIsDisburseModalOpen(true);
      showToast(`พบเครื่อง ${matchedMachine.serialNumber} (${matchedMachine.ward}) - เปิดหน้าบันทึกเบิกจ่าย`);
      return;
    }

    // 2. Search in stock items (Unit ID ST-... / QC-...)
    const matchedItem = items.find(i => i.itemCode.toUpperCase() === code);
    if (matchedItem) {
      if (matchedItem.status === 'in_stock') {
        handleOpenItemForUse(matchedItem);
      } else if (matchedItem.status === 'in_use') {
        handleMarkDepleted(matchedItem);
      }
      return;
    }

    showToast(`กรองผลลัพธ์ประวัติด้วยรหัส "${code}"`);
  };

  // Inbound Stock Submission
  const handleReceiveStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveForm.lotNumber.trim()) {
      alert('กรุณาระบุ LOT Number');
      return;
    }
    if (!receiveForm.expDate) {
      alert('กรุณาระบุวันหมดอายุตามฉลาก (EXP Date)');
      return;
    }
    const count = Math.max(1, Number(receiveForm.boxCount) || 1);
    const cleanLot = receiveForm.lotNumber.trim().toUpperCase();
    const prefix = receiveForm.category === 'strip' ? 'ST' : receiveForm.category === 'control_solution' ? 'QC' : 'BAT';

    setIsSubmittingReceive(true);

    try {
      const existingInLot = items.filter(
        i => i.lotNumber.toUpperCase() === cleanLot && i.itemType === receiveForm.category
      );
      const startIdx = existingInLot.length + 1;

      const newGeneratedItems: StripReagentItem[] = [];
      for (let i = 0; i < count; i++) {
        const currentIdx = startIdx + i;
        const indexStr = currentIdx < 10 ? `0${currentIdx}` : `${currentIdx}`;
        const itemCode = `${prefix}-${cleanLot.replace(/[^A-Z0-9]/g, '')}-${indexStr}`;

        newGeneratedItems.push({
          id: generateUUID(),
          itemCode,
          lotNumber: cleanLot,
          manufacturer: receiveForm.manufacturer.trim(),
          itemType: receiveForm.category,
          receivedDate: receiveForm.receivedDate,
          expDate: receiveForm.expDate,
          status: 'in_stock',
          notes: receiveForm.notes.trim() || undefined,
          boxIndex: currentIdx,
          totalBoxes: count
        });
      }

      const lotExists = lotConfigs.some(c => c.lotNumber.toUpperCase() === cleanLot);
      // Strictly only create QcLotConfig if receiveForm.category === 'strip'
      // QC range is strictly for strips, not control solution bottles or batteries
      if (!lotExists && onUpdateLotConfigs && receiveForm.category === 'strip') {
        const newLotConfig: QcLotConfig = {
          lotNumber: cleanLot,
          barcode: `ST-${cleanLot}`,
          manufacturer: receiveForm.manufacturer.trim(),
          testsPerBox: Number(receiveForm.testsPerBox) || 50,
          receivedDate: receiveForm.receivedDate,
          expDate: receiveForm.expDate,
          openExpDays: Number(receiveForm.openExpDays) || 90,
          notes: receiveForm.notes.trim(),
          level1Target: Number(receiveForm.level1Target) || 36,
          level1Min: Number(receiveForm.level1Min) || 21,
          level1Max: Number(receiveForm.level1Max) || 51,
          level1SD: Number(receiveForm.level1SD) || 5,
          level2Target: Number(receiveForm.level2Target) || 111,
          level2Min: Number(receiveForm.level2Min) || 89,
          level2Max: Number(receiveForm.level2Max) || 133,
          level2SD: Number(receiveForm.level2SD) || 7.3,
          level3Target: Number(receiveForm.level3Target) || 326.5,
          level3Min: Number(receiveForm.level3Min) || 261,
          level3Max: Number(receiveForm.level3Max) || 392,
          level3SD: Number(receiveForm.level3SD) || 21.8
        };
        onUpdateLotConfigs([newLotConfig, ...lotConfigs]);
        await dbService.insertLotConfig(newLotConfig).catch(() => {});
      }

      await dbService.insertStripReagentItems(newGeneratedItems);
      await loadItems();

      showToast(`รับเข้าสำเร็จ: ${count} ${receiveForm.category === 'strip' ? 'กล่อง' : receiveForm.category === 'control_solution' ? 'ขวด' : 'แพ็ค/ก้อน'} (LOT: ${cleanLot})`);
      
      setSelectedLotForPrint(cleanLot);
      setIsReceiveModalOpen(false);
      setIsBarcodePrinterOpen(true);
      setActiveTab('stock');
      setReceiveForm(initialReceiveForm);
    } catch (err: any) {
      console.error(err);
      alert(`เกิดข้อผิดพลาดในการรับเข้าพัสดุ: ${err?.message || err}`);
    } finally {
      setIsSubmittingReceive(false);
    }
  };

  // Lab Open Action
  const handleOpenItemForUse = async (item: StripReagentItem) => {
    const today = getThaiTodayDateOnly();
    const openExpDays = 90;
    const [y, m, d] = today.split('-').map(Number);
    const expObj = new Date(y, m - 1, d + openExpDays);
    const expDateStr = `${expObj.getFullYear()}-${String(expObj.getMonth() + 1).padStart(2, '0')}-${String(expObj.getDate()).padStart(2, '0')}`;

    try {
      await dbService.updateStripReagentItem(item.id, {
        status: 'in_use',
        openDate: today,
        openExpDate: expDateStr,
        openedBy: 'เจ้าหน้าที่ห้องแล็บ'
      });
      await loadItems();
      showToast(`เปิดใช้งานกล่อง ${item.itemCode} แล้ว (หมดอายุหลังเปิด: ${formatThaiDateOnly(expDateStr)})`);
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการเปิดใช้งาน: ${err?.message || err}`);
    }
  };

  // Mark Item as Depleted
  const handleMarkDepleted = (item: StripReagentItem) => {
    setConfirmDialog({
      isOpen: true,
      title: 'บันทึกพัสดุใช้งานหมดแล้ว (Depleted)',
      description: `ยืนยันบันทึกรายการ "${item.itemCode}" (LOT: ${item.lotNumber}) ว่าใช้งานหมดแล้วใช่หรือไม่?`,
      confirmText: 'บันทึกใช้หมด',
      confirmButtonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
      onConfirm: async () => {
        try {
          setConfirmDialog(prev => ({ ...prev, isLoading: true }));
          await dbService.updateStripReagentItem(item.id, {
            status: 'depleted',
            notes: (item.notes ? item.notes + ' ' : '') + `[ใช้หมดเมื่อ ${getThaiTodayDateOnly()}]`
          });
          await loadItems();
          showToast(`บันทึกรายการ ${item.itemCode} ใช้งานหมดแล้ว`);
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (err: any) {
          showToast(`เกิดข้อผิดพลาด: ${err?.message || err}`);
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  // Delete Item
  const handleDeleteItem = (itemOrId: StripReagentItem | string, optionalCode?: string) => {
    const item = typeof itemOrId === 'string' ? items.find(i => i.id === itemOrId || i.itemCode === itemOrId) : itemOrId;
    const targetId = item ? item.id : (itemOrId as string);
    const itemCode = item ? item.itemCode : (optionalCode || targetId);
    const lotNumber = item?.lotNumber || '-';

    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันลบรายการพัสดุ',
      description: `คุณต้องการลบรายการ "${itemCode}" (LOT: ${lotNumber}) ออกจากคลังพัสดุและฐานข้อมูลถาวรใช่หรือไม่?`,
      confirmText: 'ยืนยันลบรายการ',
      confirmButtonClass: 'bg-rose-600 hover:bg-rose-700 text-white',
      onConfirm: async () => {
        try {
          setConfirmDialog(prev => ({ ...prev, isLoading: true }));
          setItems(prev => prev.filter(i => i.id !== targetId && i.itemCode !== itemCode && i.id !== itemCode && i.itemCode !== targetId));
          await dbService.deleteStripReagentItem(targetId, itemCode);
          await loadItems();
          showToast(`ลบรายการ ${itemCode} ออกจากฐานข้อมูลเรียบร้อยแล้ว`);
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (err: any) {
          showToast(`เกิดข้อผิดพลาดในการลบ: ${err?.message || err}`);
          await loadItems();
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  // Save Edited Item
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      await dbService.updateStripReagentItem(editingItem.id, editingItem);
      await loadItems();
      showToast('แก้ไขข้อมูลเรียบร้อยแล้ว');
      setEditingItem(null);
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการบันทึก: ${err?.message || err}`);
    }
  };

  // Battery Disbursement Submit
  const handleDisburseBattery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disburseForm.ward.trim() || !disburseForm.requesterName.trim()) {
      alert('กรุณากรอกข้อมูลตึกและชื่อผู้ขอเบิกให้ครบถ้วน');
      return;
    }
    const newRec: BatteryDisbursementRecord = {
      id: `BAT-${Date.now()}`,
      date: getThaiTodayDateOnly(),
      ward: disburseForm.ward.trim(),
      bgmCode: disburseForm.bgmCode.trim() || undefined,
      serialNumber: disburseForm.serialNumber.trim() || undefined,
      batteryType: disburseForm.batteryType,
      quantity: Math.max(1, Number(disburseForm.quantity) || 2),
      requesterName: disburseForm.requesterName.trim(),
      dispenserName: disburseForm.dispenserName.trim() || 'เจ้าหน้าที่ห้องแล็บ',
      reason: disburseForm.reason.trim() || 'เปลี่ยนถ่านประจำเครื่อง',
      status: 'dispensed',
      notes: disburseForm.notes.trim() || undefined
    };

    try {
      await dbService.insertBatteryDisbursement(newRec);
      await loadBatteryData();
      showToast(`บันทึกการเบิกถ่าน ${newRec.batteryType} จำนวน ${newRec.quantity} ก้อน เรียบร้อยแล้ว`);
      setIsDisburseModalOpen(false);
      setDisburseForm(initialDisburseForm);
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการบันทึก: ${err?.message || err}`);
    }
  };

  const handleDeleteDisbursement = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันลบประวัติการเบิกถ่าน',
      description: 'คุณต้องการลบประวัติการเบิกถ่านรายการนี้ออกจากระบบใช่หรือไม่?',
      confirmText: 'ยืนยันลบประวัติ',
      confirmButtonClass: 'bg-rose-600 hover:bg-rose-700 text-white',
      onConfirm: async () => {
        try {
          setConfirmDialog(prev => ({ ...prev, isLoading: true }));
          setBatteryDisbursements(prev => prev.filter(b => b.id !== id));
          await dbService.deleteBatteryDisbursement(id);
          await loadBatteryData();
          showToast('ลบประวัติการเบิกถ่านเรียบร้อยแล้ว');
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (err: any) {
          showToast(`เกิดข้อผิดพลาด: ${err?.message || err}`);
          await loadBatteryData();
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  const handleDeleteSupplyRequest = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันลบประวัติคำขอเบิกพัสดุ',
      description: 'คุณต้องการลบประวัติคำขอเบิกพัสดุรายการนี้ออกจากระบบใช่หรือไม่?',
      confirmText: 'ยืนยันลบประวัติ',
      confirmButtonClass: 'bg-rose-600 hover:bg-rose-700 text-white',
      onConfirm: async () => {
        try {
          setConfirmDialog(prev => ({ ...prev, isLoading: true }));
          setLocalSupplies(prev => prev.filter(s => s.id !== id));
          if (onDeleteSupply) onDeleteSupply(id);
          await dbService.deleteSupply(id);
          showToast('ลบประวัติคำขอเบิกพัสดุเรียบร้อยแล้ว');
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (err: any) {
          showToast(`เกิดข้อผิดพลาดในการลบ: ${err?.message || err}`);
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  // Items Separation
  const inStockItems = useMemo(() => {
    return items.filter(item => item.status === 'in_stock');
  }, [items]);

  const inUseItems = useMemo(() => {
    return items.filter(item => item.status === 'in_use');
  }, [items]);

  const depletedItems = useMemo(() => {
    return items.filter(item => item.status === 'depleted');
  }, [items]);

  // Distinct LOTs
  const distinctItemLots = useMemo(() => {
    const lots = new Set<string>();
    items.forEach(i => {
      if (i.lotNumber && i.lotNumber.trim()) lots.add(i.lotNumber.trim().toUpperCase());
    });
    return Array.from(lots);
  }, [items]);

  // Filtered Stock Items for Tab 1 (คลัง)
  const filteredStockItems = useMemo(() => {
    return items.filter(item => {
      const matchStatus = stockStatusFilter === 'all' || item.status === stockStatusFilter;
      const matchCat = filterCategory === 'all' || item.itemType === filterCategory;
      const matchLot = filterLot === 'all' || (item.lotNumber && item.lotNumber.toUpperCase() === filterLot.toUpperCase());
      const q = searchOrScanCode.trim().toLowerCase();
      const matchSearch = !q || 
        item.itemCode.toLowerCase().includes(q) ||
        item.lotNumber.toLowerCase().includes(q) ||
        (item.manufacturer && item.manufacturer.toLowerCase().includes(q)) ||
        (item.openedBy && item.openedBy.toLowerCase().includes(q));
      return matchStatus && matchCat && matchLot && matchSearch;
    });
  }, [items, stockStatusFilter, filterCategory, filterLot, searchOrScanCode]);

  // CONSOLIDATED / UNIFIED DISBURSEMENT HISTORY LIST FOR TAB 2
  const unifiedHistory = useMemo<UnifiedHistoryItem[]>(() => {
    const list: UnifiedHistoryItem[] = [];

    // 1. Add Battery Disbursements
    batteryDisbursements.forEach(rec => {
      list.push({
        id: rec.id,
        category: 'battery',
        categoryLabel: 'ถ่านเครื่องตรวจ',
        date: rec.date,
        ward: rec.ward,
        itemDetails: `ถ่าน ${rec.batteryType} (เครื่อง ${rec.bgmCode || rec.serialNumber || 'ไม่ระบุ'})`,
        quantity: `${rec.quantity} ก้อน`,
        requester: rec.requesterName,
        dispenser: rec.dispenserName || 'เจ้าหน้าที่ห้องแล็บ',
        status: 'dispensed',
        reasonOrNotes: rec.reason + (rec.notes ? ` (${rec.notes})` : ''),
        isBatteryRecord: true
      });
    });

    // 2. Add Ward Supply Requests
    localSupplies.forEach(s => {
      const catLabel = s.itemType === 'machine' ? 'เครื่องตรวจ DTX' 
        : s.itemType === 'strip' ? 'แผ่นตรวจ' 
        : s.itemType === 'lancet' ? 'เข็มเจาะ' 
        : s.itemType === 'control_solution' ? 'น้ำยา QC' 
        : 'ถ่าน/อุปกรณ์';

      list.push({
        id: s.id,
        category: s.itemType as any,
        categoryLabel: catLabel,
        date: s.requestDate,
        ward: s.ward,
        itemDetails: s.reason || catLabel,
        quantity: `${s.quantity}`,
        requester: s.requesterName,
        dispenser: 'เจ้าหน้าที่คลัง/แล็บ',
        status: s.status as any,
        reasonOrNotes: s.reason,
        isBatteryRecord: false
      });
    });

    // Sort descending by date
    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [batteryDisbursements, localSupplies]);

  // Filtered Unified History Items
  const filteredUnifiedHistory = useMemo(() => {
    return unifiedHistory.filter(item => {
      const matchCat = historyCategoryFilter === 'all' || item.category === historyCategoryFilter;
      const q = historySearchTerm.trim().toLowerCase();
      const matchSearch = !q ||
        item.ward.toLowerCase().includes(q) ||
        item.itemDetails.toLowerCase().includes(q) ||
        item.requester.toLowerCase().includes(q) ||
        item.dispenser.toLowerCase().includes(q) ||
        (item.reasonOrNotes && item.reasonOrNotes.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [unifiedHistory, historyCategoryFilter, historySearchTerm]);

  // Statistics KPI Summary
  const stats = useMemo(() => {
    const strips = items.filter(i => i.itemType === 'strip');
    const controls = items.filter(i => i.itemType === 'control_solution');
    const inStockStrips = strips.filter(i => i.status === 'in_stock').length;
    const inStockControls = controls.filter(i => i.status === 'in_stock').length;
    const inUseCount = items.filter(i => i.status === 'in_use').length;
    
    const today = new Date();
    const expThreshold = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringSoon = items.filter(i => {
      if (i.status === 'depleted') return false;
      const exp = new Date(i.openExpDate || i.expDate);
      return exp <= expThreshold;
    });

    return {
      inStockStrips,
      totalStripTests: inStockStrips * 50,
      inStockControls,
      inUseCount,
      expiringSoonCount: expiringSoon.length
    };
  }, [items]);

  return (
    <div className="space-y-6" id="strip-reagent-stock-container">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 border border-slate-700 animate-fade-in">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{toastMsg}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center font-black border border-sky-200/80 dark:border-sky-800 shrink-0 shadow-2xs">
            <Package size={22} />
          </div>
          <div>
            <div className="flex items-center space-x-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                คลังพัสดุรวม: แผ่นตรวจ (Strip) • น้ำยาควบคุม (QC) • ถ่านเครื่องตรวจ (Battery)
              </h2>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                Supabase Connected
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              บริหารจัดการสต็อกแผ่นตรวจ น้ำยาควบคุมคุณภาพ และถ่านประจำเครื่องตรวจ DTX ครบวงจรในหน้าเดียว
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => { loadItems(); loadBatteryData(); }}
            disabled={isLoadingItems}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={15} className={isLoadingItems ? 'animate-spin text-sky-600' : ''} />
          </button>
        </div>
      </div>

      {/* KPI STATS STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">แผ่นตรวจพร้อมใช้ในคลัง</span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {stats.inStockStrips}
              </span>
              <span className="text-xs text-slate-500">กล่อง</span>
              <span className="text-[11px] text-slate-400 font-medium">({stats.totalStripTests} tests)</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
            <Droplet size={19} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">น้ำยาควบคุมพร้อมใช้ในคลัง</span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl sm:text-2xl font-black text-sky-600 dark:text-sky-400">
                {stats.inStockControls}
              </span>
              <span className="text-xs text-slate-500">ขวด</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center shrink-0">
            <FlaskConical size={19} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">กำลังเปิดใช้งานในแล็บ</span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
                {stats.inUseCount}
              </span>
              <span className="text-xs text-slate-500">กล่อง/ขวด</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={19} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">ใกล้หมดอายุ (&lt; 30 วัน)</span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className={`text-xl sm:text-2xl font-black ${stats.expiringSoonCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                {stats.expiringSoonCount}
              </span>
              <span className="text-xs text-slate-500">รายการ</span>
            </div>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stats.expiringSoonCount > 0 ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60' : 'bg-slate-50 text-slate-400 dark:bg-slate-800'}`}>
            <AlertTriangle size={19} />
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs Removed */}

      {/* =========================================================================
          TAB 1: คลัง (UNIFIED STOCK VIEW)
      ========================================================================= */}
      {activeTab === 'stock' && (
        <div className="space-y-4 animate-fade-in">
          {/* Status Filter Bar */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 lg:pb-0">
              <span className="text-slate-400 font-bold mr-1 shrink-0">สถานะสต็อก:</span>
              <button
                type="button"
                onClick={() => setStockStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-extrabold cursor-pointer transition-all whitespace-nowrap ${
                  stockStatusFilter === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                ทั้งหมด ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setStockStatusFilter('in_stock')}
                className={`px-3 py-1.5 rounded-xl font-extrabold cursor-pointer transition-all whitespace-nowrap ${
                  stockStatusFilter === 'in_stock'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 hover:bg-emerald-100'
                }`}
              >
                สต็อกสำรอง/ยังไม่เปิด ({inStockItems.length})
              </button>
              <button
                type="button"
                onClick={() => setStockStatusFilter('in_use')}
                className={`px-3 py-1.5 rounded-xl font-extrabold cursor-pointer transition-all whitespace-nowrap ${
                  stockStatusFilter === 'in_use'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 hover:bg-amber-100'
                }`}
              >
                เปิดใช้งานแล้ว ({inUseItems.length})
              </button>
              <button
                type="button"
                onClick={() => setStockStatusFilter('depleted')}
                className={`px-3 py-1.5 rounded-xl font-extrabold cursor-pointer transition-all whitespace-nowrap ${
                  stockStatusFilter === 'depleted'
                    ? 'bg-slate-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                ใช้งานหมดแล้ว ({depletedItems.length})
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsReceiveModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
              >
                <Plus size={14} />
                <span>+ รับเข้าพัสดุใหม่</span>
              </button>

              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs flex items-center space-x-1.5 cursor-pointer transition-colors shadow-2xs"
              >
                <History size={14} />
                <span>ประวัติเบิกพัสดุ ({unifiedHistory.length})</span>
              </button>
            </div>
          </div>

          {/* SINGLE UNIFIED SCANNER & SEARCH INPUT BAR */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <form onSubmit={handleSingleScanSubmit} className="relative flex-1 max-w-lg flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center shrink-0">
                <Barcode size={18} />
              </div>
              <div className="relative flex-1">
                <input
                  ref={scanInputRef}
                  type="text"
                  value={searchOrScanCode}
                  onChange={(e) => setSearchOrScanCode(e.target.value)}
                  placeholder="ยิงบาร์โค้ด หรือพิมพ์รหัสพัสดุ (เช่น ST-2026A-01), LOT Number, ยี่ห้อ..."
                  className="w-full pl-3.5 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold outline-none focus:ring-2 focus:ring-sky-500"
                />
                {searchOrScanCode && (
                  <button
                    type="button"
                    onClick={() => setSearchOrScanCode('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white cursor-pointer shrink-0 transition-colors"
              >
                ค้นหา
              </button>
            </form>

            {/* Quick action bar when exact item is scanned or matched */}
            {scanExactMatchedItem ? (
              <div className="flex items-center space-x-2.5 bg-sky-50 dark:bg-sky-950/60 px-3.5 py-1.5 rounded-xl border border-sky-200 dark:border-sky-800 text-xs animate-fade-in shrink-0">
                <span className="font-mono font-black text-sky-800 dark:text-sky-300">{scanExactMatchedItem.itemCode}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  scanExactMatchedItem.status === 'in_stock' ? 'bg-emerald-100 text-emerald-800' :
                  scanExactMatchedItem.status === 'in_use' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  {scanExactMatchedItem.status === 'in_stock' ? 'ยังไม่เปิด' : scanExactMatchedItem.status === 'in_use' ? 'กำลังใช้' : 'หมดแล้ว'}
                </span>

                {scanExactMatchedItem.status === 'in_stock' && (
                  <button
                    type="button"
                    onClick={() => handleOpenItemForUse(scanExactMatchedItem)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                  >
                    เปิดใช้
                  </button>
                )}
                {scanExactMatchedItem.status === 'in_use' && (
                  <button
                    type="button"
                    onClick={() => handleMarkDepleted(scanExactMatchedItem)}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] cursor-pointer"
                  >
                    ตัดหมด
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItemForPrint(scanExactMatchedItem.itemCode);
                    setIsBarcodePrinterOpen(true);
                  }}
                  className="px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] cursor-pointer flex items-center space-x-1"
                >
                  <Printer size={12} />
                  <span>พิมพ์ 50x20</span>
                </button>
              </div>
            ) : null}

            {/* Category & LOT Filters */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFilterCategory('all')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-xs ${
                    filterCategory === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ทุกประเภท
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('strip')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer text-xs ${
                    filterCategory === 'strip' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Droplet size={12} />
                  <span>แผ่นตรวจ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('control_solution')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer text-xs ${
                    filterCategory === 'control_solution' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FlaskConical size={12} />
                  <span>น้ำยา QC</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('battery')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer text-xs ${
                    filterCategory === 'battery' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Battery size={12} />
                  <span>ถ่าน</span>
                </button>
              </div>

              <select
                value={filterLot}
                onChange={(e) => setFilterLot(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer text-xs"
              >
                <option value="all">ทุก LOT ({distinctItemLots.length})</option>
                {distinctItemLots.map(lot => (
                  <option key={lot} value={lot}>LOT {lot}</option>
                ))}
              </select>

              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg cursor-pointer ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'}`}
                  title="แสดงแบบตาราง"
                >
                  <TableIcon size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`p-1.5 rounded-lg cursor-pointer ${viewMode === 'cards' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'}`}
                  title="แสดงแบบการ์ด"
                >
                  <LayoutGrid size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Table of Filtered Stock Items */}
          {filteredStockItems.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-500 flex items-center justify-center mx-auto">
                <Box size={28} />
              </div>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                ไม่พบรายการพัสดุตามเงื่อนไขที่เลือก
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                ลองปรับเปลี่ยนตัวกรอง หรือกดปุ่ม "+ รับเข้าพัสดุใหม่" เพื่อลงบันทึกพัสดุเพิ่มเข้าคลัง
              </p>
            </div>
          ) : viewMode === 'table' ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                      <th className="p-3.5 pl-5 w-10">
                        <input
                          type="checkbox"
                          checked={filteredStockItems.length > 0 && selectedStockIds.length === filteredStockItems.length}
                          onChange={handleSelectAllStockItems}
                          className="w-4 h-4 rounded text-sky-600 border-slate-300 focus:ring-sky-500 cursor-pointer"
                        />
                      </th>
                      <th className="p-3.5">รหัสพัสดุ (Unit ID)</th>
                      <th className="p-3.5">บาร์โค้ด Code128</th>
                      <th className="p-3.5">ประเภท</th>
                      <th className="p-3.5">LOT Number</th>
                      <th className="p-3.5">สถานะคลัง</th>
                      <th className="p-3.5">วันรับเข้า / หมดอายุ</th>
                      <th className="p-3.5 pr-5 text-right">การจัดการ / พิมพ์สติกเกอร์</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredStockItems.map(item => (
                      <tr 
                        key={item.id}
                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                          selectedStockIds.includes(item.id) ? 'bg-sky-50/60 dark:bg-sky-950/30' : ''
                        }`}
                      >
                        <td className="p-3.5 pl-5">
                          <input
                            type="checkbox"
                            checked={selectedStockIds.includes(item.id)}
                            onChange={() => handleToggleSelectStockItem(item.id)}
                            className="w-4 h-4 rounded text-sky-600 border-slate-300 focus:ring-sky-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-3.5">
                          <div className="font-mono font-black text-slate-900 dark:text-white text-xs">
                            {item.itemCode}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            ลำดับที่ {item.boxIndex || 1}/{item.totalBoxes || 1}
                          </span>
                        </td>

                        <td className="p-3.5">
                          <div className="w-36">
                            <Code128Barcode text={item.itemCode} height={20} barWidth={1.0} showText={false} />
                          </div>
                        </td>

                        <td className="p-3.5">
                          <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                            item.itemType === 'strip' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                              : item.itemType === 'control_solution'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800'
                              : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                          }`}>
                            {item.itemType === 'strip' ? <Droplet size={11} /> : item.itemType === 'control_solution' ? <FlaskConical size={11} /> : <Battery size={11} />}
                            <span>{item.itemType === 'strip' ? 'แผ่นตรวจ' : item.itemType === 'control_solution' ? 'น้ำยา QC' : 'ถ่าน'}</span>
                          </span>
                        </td>

                        <td className="p-3.5">
                          <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {item.lotNumber}
                          </div>
                          <span className="text-[10px] text-slate-400">{item.manufacturer || 'VivaChek'}</span>
                        </td>

                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${
                            item.status === 'in_stock'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : item.status === 'in_use'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {item.status === 'in_stock' ? 'ยังไม่เปิดฝา' : item.status === 'in_use' ? 'กำลังเปิดใช้' : 'ใช้หมดแล้ว'}
                          </span>
                        </td>

                        <td className="p-3.5 text-slate-600 dark:text-slate-400 font-bold">
                          <div>รับ: {formatThaiDateOnly(item.receivedDate)}</div>
                          <div className="text-[10px] text-rose-500 font-mono">
                            EXP: {item.openExpDate ? formatThaiDateOnly(item.openExpDate) : (item.expDate ? formatThaiDateOnly(item.expDate) : '-')}
                          </div>
                        </td>

                        <td className="p-3.5 pr-5 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {item.status === 'in_stock' && (
                              <button
                                type="button"
                                onClick={() => handleOpenItemForUse(item)}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors flex items-center space-x-1"
                                title="เปิดใช้งานในแล็บ"
                              >
                                <CheckCircle size={12} />
                                <span>เปิดใช้</span>
                              </button>
                            )}

                            {item.status === 'in_use' && (
                              <button
                                type="button"
                                onClick={() => handleMarkDepleted(item)}
                                className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
                                title="บันทึกว่าใช้หมดแล้ว"
                              >
                                ตัดยอดหมด
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedItemForPrint(item.itemCode);
                                setIsBarcodePrinterOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs cursor-pointer transition-colors flex items-center space-x-1"
                              title="พิมพ์สติกเกอร์บาร์โค้ด Zebra 50x20 mm ประจำรายการนี้"
                            >
                              <Printer size={13} />
                              <span>พิมพ์ 50x20</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditingItem(item)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
                              title="แก้ไขข้อมูล"
                            >
                              <Edit2 size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50 hover:text-rose-600 text-slate-400 cursor-pointer transition-colors"
                              title="ลบรายการ"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStockItems.map(item => (
                <div 
                  key={item.id}
                  className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono font-black text-slate-900 dark:text-white text-sm block">
                        {item.itemCode}
                      </span>
                      <span className="text-[10px] text-slate-400">LOT: {item.lotNumber}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.status === 'in_stock' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                      item.status === 'in_use' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                      'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {item.status === 'in_stock' ? 'ยังไม่เปิด' : item.status === 'in_use' ? 'กำลังเปิดใช้' : 'ใช้หมดแล้ว'}
                    </span>
                  </div>

                  <div className="flex justify-center py-1">
                    <Code128Barcode text={item.itemCode} height={28} barWidth={1.2} />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                    <span className="text-slate-400 font-bold">EXP: {item.expDate ? formatThaiDateOnly(item.expDate) : '-'}</span>
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItemForPrint(item.itemCode);
                          setIsBarcodePrinterOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center space-x-1 cursor-pointer transition-colors"
                      >
                        <Printer size={12} />
                        <span>พิมพ์ 50x20</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingItem(item)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
                        title="แก้ไขข้อมูล"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50 hover:text-rose-600 text-slate-400 cursor-pointer transition-colors"
                        title="ลบรายการ"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Floating Bulk Action Bar for Stock Items */}
      {selectedStockIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center space-x-3 text-xs animate-fade-in">
          <span className="font-bold text-sky-400 bg-slate-800 dark:bg-slate-900 px-3 py-1 rounded-xl border border-slate-700">
            เลือกอยู่ {selectedStockIds.length} รายการ
          </span>
          <div className="h-4 w-px bg-slate-700" />
          <button
            type="button"
            onClick={handleBulkOpenForUse}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
          >
            <CheckCircle size={13} />
            <span>เปิดใช้งานพร้อมกัน</span>
          </button>
          <button
            type="button"
            onClick={handleBulkMarkDepleted}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold text-white flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
          >
            <Clock size={13} />
            <span>ตัดยอดใช้หมดพร้อมกัน</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const firstSelected = items.find(i => selectedStockIds.includes(i.id));
              setSelectedItemForPrint(firstSelected?.itemCode);
              setIsBarcodePrinterOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 font-bold text-white flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
          >
            <Printer size={13} />
            <span>พิมพ์บาร์โค้ด Zebra</span>
          </button>
          <button
            type="button"
            onClick={handleBulkDeleteItems}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-white flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
          >
            <Trash2 size={13} />
            <span>ลบที่เลือก</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedStockIds([])}
            className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            title="ยกเลิกการเลือก"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* MODAL: Consolidated History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-5xl w-full space-y-4 text-xs shadow-2xl overflow-y-auto max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    ประวัติการเบิกจ่ายรวมทั้งหมด (Consolidated Disbursement History)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    รวมประวัติการจ่ายเบิกถ่าน และรายการเบิกพัสดุ/อุปกรณ์ของหอผู้ป่วยไว้ในที่เดียวกัน
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsDisburseModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-2xs cursor-pointer transition-colors"
                >
                  <Plus size={14} />
                  <span>+ บันทึกเบิกถ่านใหม่</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Barcode Scanner & Search Bar inside History Modal */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <form onSubmit={handleDisburseScanSubmit} className="relative flex-1 max-w-md flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-600 flex items-center justify-center shrink-0">
                  <Barcode size={18} />
                </div>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={historySearchTerm}
                    onChange={(e) => setHistorySearchTerm(e.target.value)}
                    placeholder="ยิงบาร์โค้ดสั่งเบิก (เช่น BGM-01 หรือ ST-...) หรือพิมพ์ค้นหา..."
                    className="w-full pl-3 pr-8 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                  />
                  {historySearchTerm && (
                    <button
                      type="button"
                      onClick={() => setHistorySearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white cursor-pointer shrink-0 transition-colors flex items-center space-x-1"
                >
                  <Barcode size={13} />
                  <span>ค้นหา/สแกน</span>
                </button>
              </form>

              <div className="flex items-center space-x-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setHistoryCategoryFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap text-xs ${
                    historyCategoryFilter === 'all' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ทั้งหมด ({unifiedHistory.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryCategoryFilter('battery')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer whitespace-nowrap text-xs ${
                    historyCategoryFilter === 'battery' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Battery size={12} />
                  <span>ถ่าน</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryCategoryFilter('strip')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer whitespace-nowrap text-xs ${
                    historyCategoryFilter === 'strip' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Droplet size={12} />
                  <span>แผ่นตรวจ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryCategoryFilter('machine')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer whitespace-nowrap text-xs ${
                    historyCategoryFilter === 'machine' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Smartphone size={12} />
                  <span>เครื่องตรวจ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryCategoryFilter('control_solution')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer whitespace-nowrap text-xs ${
                    historyCategoryFilter === 'control_solution' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FlaskConical size={12} />
                  <span>น้ำยา QC</span>
                </button>
              </div>
            </div>

            {/* CONSOLIDATED HISTORY TABLE INSIDE MODAL */}
            {filteredUnifiedHistory.length === 0 ? (
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-500 flex items-center justify-center mx-auto">
                  <History size={24} />
                </div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  ยังไม่มีประวัติการเบิกตามเงื่อนไขที่เลือก
                </h4>
                <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                  เมื่อมีการลงบันทึกเบิกถ่าน หรือการขอเบิกพัสดุจากหอผู้ป่วย ประวัติจะมาปรากฏรวบรวมในตารางนี้ทั้งหมด
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto max-h-[55vh]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3 pl-4">วันที่ทำรายการ</th>
                        <th className="p-3">หมวดหมู่</th>
                        <th className="p-3">หน่วยงาน / หอผู้ป่วย (Ward)</th>
                        <th className="p-3">รายการเบิก & รายละเอียด</th>
                        <th className="p-3">จำนวน</th>
                        <th className="p-3">ผู้ขอเบิก / ผู้จ่าย</th>
                        <th className="p-3">สถานะ</th>
                        <th className="p-3 pr-4 text-right">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredUnifiedHistory.map(rec => (
                        <tr key={rec.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 pl-4 font-bold text-slate-900 dark:text-white whitespace-nowrap text-[11px]">
                            {formatThaiDateOnly(rec.date)}
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${
                              rec.category === 'battery' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                              rec.category === 'strip' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                              rec.category === 'machine' ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' :
                              rec.category === 'control_solution' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' :
                              'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                            }`}>
                              {rec.category === 'battery' && <Battery size={10} />}
                              {rec.category === 'strip' && <Droplet size={10} />}
                              {rec.category === 'machine' && <Smartphone size={10} />}
                              {rec.category === 'control_solution' && <FlaskConical size={10} />}
                              <span>{rec.categoryLabel}</span>
                            </span>
                          </td>

                          <td className="p-3 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {rec.ward}
                          </td>

                          <td className="p-3 font-bold text-slate-900 dark:text-white">
                            <div>{rec.itemDetails}</div>
                            {rec.reasonOrNotes && (
                              <div className="text-[10px] text-slate-400 font-normal">{rec.reasonOrNotes}</div>
                            )}
                          </td>

                          <td className="p-3 font-mono font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                            {rec.quantity}
                          </td>

                          <td className="p-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            <div className="font-bold">เบิก: {rec.requester}</div>
                            <div className="text-[10px] text-slate-400">จ่าย: {rec.dispenser}</div>
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rec.status === 'approved' || rec.status === 'dispensed'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : rec.status === 'rejected'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {rec.status === 'approved' || rec.status === 'dispensed' ? 'จ่ายเรียบร้อย' : rec.status === 'rejected' ? 'ปฏิเสธ' : 'รอดำเนินการ'}
                            </span>
                          </td>

                          <td className="p-3 pr-4 text-right whitespace-nowrap">
                            {rec.isBatteryRecord ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteDisbursement(rec.id)}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50 hover:text-rose-600 text-slate-400 cursor-pointer transition-colors flex items-center space-x-1 text-xs"
                                title="ลบประวัติการเบิกถ่าน"
                              >
                                <Trash2 size={12} />
                                <span>ลบ</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDeleteSupplyRequest(rec.id)}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50 hover:text-rose-600 text-slate-400 cursor-pointer transition-colors flex items-center space-x-1 text-xs"
                                title="ลบประวัติคำขอเบิก"
                              >
                                <Trash2 size={12} />
                                <span>ลบ</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold text-xs cursor-pointer hover:bg-slate-800 transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 0: Receive New Stock Modal */}
      {isReceiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-2xl w-full space-y-4 text-xs shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Plus size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    บันทึกรับเข้าวัสดุแผ่นตรวจ / น้ำยาควบคุมใหม่ (Inbound Lab Stock)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    ระบบจะสร้างรหัสประจำกล่อง/ขวด (ST-... / QC-...) และบาร์โค้ด Code128 ให้อัตโนมัติตามจำนวนที่รับเข้า
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReceiveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReceiveStockSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">ประเภทวัสดุ:</label>
                  <select
                    value={receiveForm.category}
                    onChange={(e) => setReceiveForm({ ...receiveForm, category: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="strip">แผ่นตรวจน้ำตาล (Test Strip)</option>
                    <option value="control_solution">น้ำยาควบคุมคุณภาพ (Control Solution)</option>
                    <option value="battery">ถ่านเครื่องตรวจ (Batteries AAA / AA / CR2032)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">LOT Number:</label>
                  <input
                    type="text"
                    value={receiveForm.lotNumber}
                    onChange={(e) => setReceiveForm({ ...receiveForm, lotNumber: e.target.value.toUpperCase() })}
                    placeholder="เช่น 2026A, L102..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">บริษัท / ยี่ห้อ:</label>
                  <input
                    type="text"
                    value={receiveForm.manufacturer}
                    onChange={(e) => setReceiveForm({ ...receiveForm, manufacturer: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">จำนวนที่รับเข้า (กล่อง/ขวด):</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={receiveForm.boxCount}
                    onChange={(e) => setReceiveForm({ ...receiveForm, boxCount: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">จำนวน test ต่อกล่อง/ขวด:</label>
                  <input
                    type="number"
                    value={receiveForm.testsPerBox}
                    onChange={(e) => setReceiveForm({ ...receiveForm, testsPerBox: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">วันที่รับเข้า:</label>
                  <input
                    type="date"
                    value={receiveForm.receivedDate}
                    onChange={(e) => setReceiveForm({ ...receiveForm, receivedDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">วันหมดอายุตามฉลาก (EXP Date):</label>
                  <input
                    type="date"
                    value={receiveForm.expDate}
                    onChange={(e) => setReceiveForm({ ...receiveForm, expDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">หมายเหตุการรับเข้า:</label>
                <input
                  type="text"
                  value={receiveForm.notes}
                  onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })}
                  placeholder="เช่น ใบสั่งซื้อเลขที่ PO-1234..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsReceiveModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReceive}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center space-x-1.5 cursor-pointer shadow-md shadow-emerald-600/20 transition-colors"
                >
                  <Save size={16} />
                  <span>{isSubmittingReceive ? 'กำลังบันทึก...' : 'บันทึกรับเข้า & สั่งพิมพ์บาร์โค้ด Zebra'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center">
                  <Edit2 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    แก้ไขข้อมูลพัสดุ ({editingItem.itemCode})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    แก้ไข LOT Number หรือวันหมดอายุของพัสดุ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">รหัสประจำกล่อง (Unit ID):</label>
                <input
                  type="text"
                  value={editingItem.itemCode}
                  disabled
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 font-mono font-bold text-slate-500 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">LOT Number:</label>
                <input
                  type="text"
                  value={editingItem.lotNumber}
                  onChange={(e) => setEditingItem({ ...editingItem, lotNumber: e.target.value.toUpperCase() })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">วันที่รับเข้า:</label>
                  <input
                    type="date"
                    value={editingItem.receivedDate || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, receivedDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">วันหมดอายุ (EXP):</label>
                  <input
                    type="date"
                    value={editingItem.expDate || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, expDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">หมายเหตุ:</label>
                <input
                  type="text"
                  value={editingItem.notes || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black flex items-center space-x-1.5 cursor-pointer shadow-sm transition-colors"
                >
                  <Save size={15} />
                  <span>บันทึกการแก้ไข</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Battery Disbursement Modal */}
      {isDisburseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                  <Battery size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    บันทึกเบิกถ่านเครื่องตรวจ DTX
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    จ่ายถ่านเปลี่ยนให้เครื่องตรวจประจำหอผู้ป่วย
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDisburseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDisburseBattery} className="space-y-3.5">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">หอผู้ป่วยที่ขอเบิก (Target Ward):</label>
                <select
                  value={disburseForm.ward}
                  onChange={(e) => setDisburseForm({ ...disburseForm, ward: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  required
                >
                  <option value="">-- กรุณาเลือก Ward --</option>
                  {wards.map(w => (
                    <option key={w.en_name} value={w.thai_name}>{w.thai_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">รหัสเครื่อง (CODE BGM):</label>
                  <input
                    type="text"
                    value={disburseForm.bgmCode}
                    onChange={(e) => setDisburseForm({ ...disburseForm, bgmCode: e.target.value.toUpperCase() })}
                    placeholder="เช่น BGM-01..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">ชนิดถ่าน:</label>
                  <select
                    value={disburseForm.batteryType}
                    onChange={(e) => setDisburseForm({ ...disburseForm, batteryType: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="AAA">ถ่าน AAA (2 ก้อน/เครื่อง)</option>
                    <option value="AA">ถ่าน AA</option>
                    <option value="CR2032">ถ่านกระดุม CR2032</option>
                    <option value="other">อื่นๆ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">จำนวนที่เบิก (ก้อน):</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={disburseForm.quantity}
                    onChange={(e) => setDisburseForm({ ...disburseForm, quantity: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">ชื่อผู้ขอเบิก (พยาบาล/เจ้าหน้าที่):</label>
                  <input
                    type="text"
                    value={disburseForm.requesterName}
                    onChange={(e) => setDisburseForm({ ...disburseForm, requesterName: e.target.value })}
                    placeholder="ชื่อผู้ขอเบิก..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">เหตุผล / บันทึก:</label>
                <input
                  type="text"
                  value={disburseForm.reason}
                  onChange={(e) => setDisburseForm({ ...disburseForm, reason: e.target.value })}
                  placeholder="เช่น เปลี่ยนถ่านประจำเครื่อง, ถ่านหมด..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsDisburseModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black flex items-center space-x-1.5 cursor-pointer shadow-sm transition-colors"
                >
                  <CheckCircle size={15} />
                  <span>บันทึกการเบิกถ่าน</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Zebra Barcode Printer Modal */}
      {isBarcodePrinterOpen && (
        <BarcodePrinterModal
          isOpen={isBarcodePrinterOpen}
          stockItems={items}
          lotConfigs={lotConfigs}
          initialItemCode={selectedItemForPrint}
          initialLotNumber={selectedLotForPrint}
          onClose={() => {
            setIsBarcodePrinterOpen(false);
            setSelectedItemForPrint(undefined);
            setSelectedLotForPrint(undefined);
          }}
        />
      )}

      {/* Universal In-App Confirmation Modal Dialog (Zero native confirm() blocks) */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-5 animate-scale-up">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-1.5 flex-1 text-left">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  {confirmDialog.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                disabled={confirmDialog.isLoading}
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer transition-colors disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={confirmDialog.isLoading}
                onClick={() => confirmDialog.onConfirm()}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-50 ${
                  confirmDialog.confirmButtonClass || 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
              >
                {confirmDialog.isLoading && <RefreshCw size={14} className="animate-spin" />}
                <span>{confirmDialog.confirmText || 'ยืนยัน'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
