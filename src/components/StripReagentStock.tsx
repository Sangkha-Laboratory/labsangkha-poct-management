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
import { dbService } from '../lib/supabase';
import { getThaiTodayDateOnly, formatThaiDateOnly } from '../lib/dateUtils';
import { BarcodePrinterModal } from './BarcodePrinterModal';
import JsBarcode from 'jsbarcode';
import { 
  Package, Search, Filter, Layers, Clock, AlertTriangle, 
  CheckCircle2, Barcode, Sparkles, Droplet, FlaskConical, 
  Calendar, Building2, User, ChevronRight, RefreshCw, FileText,
  Plus, Edit2, Trash2, X, SlidersHorizontal, Calculator, Save, Info, Zap,
  Table as TableIcon, LayoutGrid, Printer, Download, Battery, BatteryCharging,
  QrCode, Check, ArrowRight, History, ShieldCheck, Box
} from 'lucide-react';

interface StripReagentStockProps {
  lotConfigs: QcLotConfig[];
  supplies?: SupplyRequest[];
  machines?: DtxMachine[];
  onUpdateLotConfigs?: (configs: QcLotConfig[]) => void;
}

// 100% Compliant Code 128 Barcode Vector Renderer (Fully Scannable by Handheld Scanners)
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
          format: "CODE128", // Full Code 128 with auto subset switching & modulo 103 checksum
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
  onUpdateLotConfigs
}: StripReagentStockProps) {
  // Navigation Tabs: Clean separation
  const [activeTab, setActiveTab] = useState<'inventory' | 'receive' | 'history' | 'print' | 'battery'>('inventory');

  // Database Items State (Zero Mock Data, Strictly Supabase)
  const [items, setItems] = useState<StripReagentItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'strip' | 'control_solution'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_stock' | 'in_use' | 'depleted'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Quick Barcode Scan Input (For handheld laser/CCD scanner guns in lab)
  const [scannedCode, setScannedCode] = useState('');
  const [scanResultItem, setScanResultItem] = useState<StripReagentItem | null>(null);
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  // Modals & Notifications
  const [toastMsg, setToastMsg] = useState<string>('');
  const [editingItem, setEditingItem] = useState<StripReagentItem | null>(null);
  const [isBarcodePrinterOpen, setIsBarcodePrinterOpen] = useState(false);
  const [selectedItemForPrint, setSelectedItemForPrint] = useState<string | undefined>(undefined);
  const [selectedLotForPrint, setSelectedLotForPrint] = useState<string | undefined>(undefined);

  // Battery Disbursement State
  const [batteryDisbursements, setBatteryDisbursements] = useState<BatteryDisbursementRecord[]>([]);
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);
  const [batterySearch, setBatterySearch] = useState('');
  const [batteryWardFilter, setBatteryWardFilter] = useState('all');

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

  // Inbound Receive Form State
  const initialReceiveForm = {
    category: 'strip' as 'strip' | 'control_solution',
    lotNumber: '',
    manufacturer: 'VivaChek Fad',
    boxCount: 5, // จำนวนกล่อง/ขวดที่รับเข้า
    testsPerBox: 50,
    receivedDate: getThaiTodayDateOnly(),
    expDate: '',
    openExpDays: 90, // วันหมดอายุหลังเปิดขวด (แล็บกำหนด +90 วัน)
    notes: '',
    // QC targets if registering a new lot alongside strips/controls
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
  }, []);

  // Quick Barcode Scan Handler (Enter from handheld scanner gun)
  const handleQuickScan = (e: React.FormEvent) => {
    e.preventDefault();
    const code = scannedCode.trim().toUpperCase();
    if (!code) return;

    const found = items.find(i => 
      i.itemCode.toUpperCase() === code || 
      i.lotNumber.toUpperCase() === code
    );

    if (found) {
      setScanResultItem(found);
      showToast(` พบรหัสพัสดุ: ${found.itemCode} (LOT: ${found.lotNumber})`);
    } else {
      setScanResultItem(null);
      showToast(`️ ไม่พบรหัสพัสดุ "${code}" ในฐานข้อมูลคลัง`);
    }
  };

  // Inbound Stock Submission (Generate Unique Unit Barcodes & Save to Supabase)
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
    const prefix = receiveForm.category === 'strip' ? 'ST' : 'QC';

    setIsSubmittingReceive(true);

    try {
      // Find existing count for this lot to calculate sequential boxIndex
      const existingInLot = items.filter(
        i => i.lotNumber.toUpperCase() === cleanLot && i.itemType === receiveForm.category
      );
      const startIdx = existingInLot.length + 1;

      const newGeneratedItems: StripReagentItem[] = [];
      for (let i = 0; i < count; i++) {
        const currentIdx = startIdx + i;
        const indexStr = currentIdx < 10 ? `0${currentIdx}` : `${currentIdx}`;
        // Standard Lab Barcode format: ST-[LOT]-[INDEX] (e.g. ST-2026A-01)
        const itemCode = `${prefix}-${cleanLot.replace(/[^A-Z0-9]/g, '')}-${indexStr}`;

        newGeneratedItems.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${i}`,
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

      // Also ensure QC Lot Config exists if this is a new lot
      const lotExists = lotConfigs.some(c => c.lotNumber.toUpperCase() === cleanLot);
      if (!lotExists && onUpdateLotConfigs) {
        const newLotConfig: QcLotConfig = {
          lotNumber: cleanLot,
          barcode: `${prefix}-${cleanLot}`,
          manufacturer: receiveForm.manufacturer.trim(),
          testsPerBox: Number(receiveForm.testsPerBox) || 50,
          receivedDate: receiveForm.receivedDate,
          expDate: receiveForm.expDate,
          openExpDays: Number(receiveForm.openExpDays) || 90,
          notes: receiveForm.notes.trim(),
          level1Target: Number(receiveForm.level1Target),
          level1Min: Number(receiveForm.level1Min),
          level1Max: Number(receiveForm.level1Max),
          level1SD: Number(receiveForm.level1SD),
          level2Target: Number(receiveForm.level2Target),
          level2Min: Number(receiveForm.level2Min),
          level2Max: Number(receiveForm.level2Max),
          level2SD: Number(receiveForm.level2SD),
          level3Target: Number(receiveForm.level3Target),
          level3Min: Number(receiveForm.level3Min),
          level3Max: Number(receiveForm.level3Max),
          level3SD: Number(receiveForm.level3SD)
        };
        onUpdateLotConfigs([newLotConfig, ...lotConfigs]);
        await dbService.insertLotConfig(newLotConfig).catch(() => {});
      }

      // Save directly to Supabase
      await dbService.insertStripReagentItems(newGeneratedItems);

      // Reload fresh items from Supabase
      await loadItems();

      showToast(` รับเข้าสำเร็จ: ${count} ${receiveForm.category === 'strip' ? 'กล่อง' : 'ขวด'} (LOT: ${cleanLot}) พร้อมสร้างบาร์โค้ด Code128 เรียบร้อย`);
      
      // Auto open barcode printer for immediate 50x20 Zebra printing
      setSelectedLotForPrint(cleanLot);
      setIsBarcodePrinterOpen(true);

      // Switch to Inventory tab to see newly received items
      setActiveTab('inventory');
      setReceiveForm(initialReceiveForm);
    } catch (err: any) {
      console.error(err);
      alert(`เกิดข้อผิดพลาดในการรับเข้าพัสดุ: ${err?.message || err}`);
    } finally {
      setIsSubmittingReceive(false);
    }
  };

  // Lab Open Action (เปิดใช้งาน 1 กล่อง/ขวด ในห้องแล็บ)
  const handleOpenItemForUse = async (item: StripReagentItem) => {
    const today = getThaiTodayDateOnly();
    const openExpDays = 90; // Default 90 days after opening
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
      showToast(` เปิดใช้งานกล่อง ${item.itemCode} แล้ว (หมดอายุหลังเปิด: ${formatThaiDateOnly(expDateStr)})`);
      if (scanResultItem?.id === item.id) {
        setScanResultItem({
          ...scanResultItem,
          status: 'in_use',
          openDate: today,
          openExpDate: expDateStr
        });
      }
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการเปิดใช้งาน: ${err?.message || err}`);
    }
  };

  // Mark Item as Depleted (ใช้หมดแล้ว / ตัดสต็อก)
  const handleMarkDepleted = async (item: StripReagentItem) => {
    if (!confirm(`ยืนยันบันทึกกล่อง/ขวด ${item.itemCode} ว่าใช้งานหมดแล้ว (Depleted)?`)) return;

    try {
      await dbService.updateStripReagentItem(item.id, {
        status: 'depleted',
        notes: (item.notes ? item.notes + ' ' : '') + `[ใช้หมดเมื่อ ${getThaiTodayDateOnly()}]`
      });
      await loadItems();
      showToast(` บันทึกกล่อง ${item.itemCode} ใช้งานหมดแล้ว`);
      if (scanResultItem?.id === item.id) {
        setScanResultItem({ ...scanResultItem, status: 'depleted' });
      }
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาด: ${err?.message || err}`);
    }
  };

  // Delete Item
  const handleDeleteItem = async (id: string) => {
    if (!confirm('ยืนยันลบรายการพัสดุนี้ออกจากฐานข้อมูล?')) return;
    try {
      await dbService.deleteStripReagentItem(id);
      await loadItems();
      showToast(' ลบรายการออกจากฐานข้อมูลเรียบร้อยแล้ว');
      if (scanResultItem?.id === id) setScanResultItem(null);
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการลบ: ${err?.message || err}`);
    }
  };

  // Save Edited Item
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      await dbService.updateStripReagentItem(editingItem.id, editingItem);
      await loadItems();
      showToast(' แก้ไขข้อมูลเรียบร้อยแล้ว');
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
      showToast(` บันทึกการเบิกถ่าน ${newRec.batteryType} จำนวน ${newRec.quantity} ก้อน เรียบร้อยแล้ว`);
      setIsDisburseModalOpen(false);
      setDisburseForm(initialDisburseForm);
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการบันทึก: ${err?.message || err}`);
    }
  };

  const handleDeleteDisbursement = async (id: string) => {
    if (!confirm('ยืนยันลบประวัติการเบิกถ่านนี้?')) return;
    try {
      await dbService.deleteBatteryDisbursement(id);
      await loadBatteryData();
      showToast(' ลบประวัติเรียบร้อยแล้ว');
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาด: ${err?.message || err}`);
    }
  };

  // Filtered Items Calculation
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchCat = filterCategory === 'all' || item.itemType === filterCategory;
      const matchStatus = filterStatus === 'all' || item.status === filterStatus;
      const matchSearch = !searchTerm.trim() || 
        item.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.manufacturer && item.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchCat && matchStatus && matchSearch;
    });
  }, [items, filterCategory, filterStatus, searchTerm]);

  // Movement & History Items (Items with openDate or depleted status)
  const movementHistory = useMemo(() => {
    return [...items].sort((a, b) => {
      const dateA = a.openDate || a.receivedDate || '';
      const dateB = b.openDate || b.receivedDate || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [items]);

  // Statistics KPI Summary
  const stats = useMemo(() => {
    const strips = items.filter(i => i.itemType === 'strip');
    const controls = items.filter(i => i.itemType === 'control_solution');
    const inStockStrips = strips.filter(i => i.status === 'in_stock').length;
    const inStockControls = controls.filter(i => i.status === 'in_stock').length;
    const inUseItems = items.filter(i => i.status === 'in_use');
    
    // Check expiry within 30 days
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
      inUseCount: inUseItems.length,
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

      {/* TOP HEADER: Clean Title & Primary Action Controls */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-black shadow-lg shadow-emerald-600/20 shrink-0">
            <Package size={24} />
          </div>
          <div>
            <div className="flex items-center space-x-2.5 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                คลังวัสดุแผ่นตรวจ (Test Strip) & น้ำยาควบคุม (Lab Internal Stock)
              </h2>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                Supabase Connected
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              ระบบบาร์โค้ด Code128 รายกล่อง/ขวด สำหรับห้องแล็บใช้งานเอง ตัดใช้ทีละ 1 หน่วย พร้อมรองรับเครื่องพิมพ์ Zebra (50x20 mm)
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            type="button"
            onClick={loadItems}
            disabled={isLoadingItems}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="รีเฟรชข้อมูลจากฐานข้อมูล"
          >
            <RefreshCw size={16} className={isLoadingItems ? 'animate-spin text-emerald-600' : ''} />
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedItemForPrint(undefined);
              setSelectedLotForPrint(undefined);
              setIsBarcodePrinterOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white text-xs font-black flex items-center space-x-2 transition-all cursor-pointer shadow-md shadow-sky-600/20"
          >
            <Printer size={15} />
            <span>พิมพ์สติกเกอร์ Zebra (50x20 mm)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('receive')}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black flex items-center space-x-2 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
          >
            <Plus size={16} />
            <span>+ รับเข้าพัสดุใหม่</span>
          </button>
        </div>
      </div>

      {/* KPI STATS STRIP: 4 Essential Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Strip in stock */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">แผ่นตรวจพร้อมใช้</span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {stats.inStockStrips}
              </span>
              <span className="text-xs text-slate-500">กล่อง</span>
              <span className="text-[11px] text-slate-400">({stats.totalStripTests} tests)</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
            <Droplet size={20} />
          </div>
        </div>

        {/* Control solution in stock */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">น้ำยาควบคุมพร้อมใช้</span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl sm:text-2xl font-black text-sky-600 dark:text-sky-400">
                {stats.inStockControls}
              </span>
              <span className="text-xs text-slate-500">ขวด</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center shrink-0">
            <FlaskConical size={20} />
          </div>
        </div>

        {/* In-Use in Lab */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">กำลังเปิดใช้งานในแล็บ</span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
                {stats.inUseCount}
              </span>
              <span className="text-xs text-slate-500">หน่วย (In Use)</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
        </div>

        {/* Expiring Soon Alert */}
        <div className={`p-4 rounded-2xl border shadow-xs flex items-center justify-between ${
          stats.expiringSoonCount > 0 
            ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800' 
            : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
        }`}>
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">ใกล้หมดอายุ (&le; 30 วัน)</span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className={`text-xl sm:text-2xl font-black ${stats.expiringSoonCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                {stats.expiringSoonCount}
              </span>
              <span className="text-xs text-slate-500">รายการ</span>
            </div>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            stats.expiringSoonCount > 0 
              ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-600' 
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
          }`}>
            <AlertTriangle size={20} />
          </div>
        </div>
      </div>

      {/* QUICK SCANNER BAR (Gun Scanner Ready) */}
      <div className="bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <form onSubmit={handleQuickScan} className="flex items-center space-x-2 flex-1 max-w-xl">
          <div className="w-8 h-8 rounded-lg bg-sky-600/30 text-sky-400 flex items-center justify-center shrink-0">
            <Barcode size={18} />
          </div>
          <div className="relative flex-1">
            <input
              ref={scanInputRef}
              type="text"
              value={scannedCode}
              onChange={(e) => setScannedCode(e.target.value)}
              placeholder="ยิงบาร์โค้ด หรือพิมพ์รหัสพัสดุ (เช่น ST-LOT2026A-01)..."
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white cursor-pointer shrink-0 transition-colors"
          >
            ค้นหา
          </button>
        </form>

        {/* Scan Quick Result Preview */}
        {scanResultItem ? (
          <div className="flex items-center space-x-3 bg-slate-800 px-3.5 py-1.5 rounded-xl border border-slate-700 text-xs animate-fade-in flex-wrap gap-y-1">
            <div className="flex items-center space-x-2">
              <span className="font-mono font-bold text-sky-300">{scanResultItem.itemCode}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                scanResultItem.status === 'in_stock' ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700' :
                scanResultItem.status === 'in_use' ? 'bg-amber-900/60 text-amber-300 border border-amber-700' :
                'bg-slate-700 text-slate-300'
              }`}>
                {scanResultItem.status === 'in_stock' ? 'ยังไม่เปิด' : scanResultItem.status === 'in_use' ? 'กำลังใช้' : 'หมดแล้ว'}
              </span>
            </div>

            <div className="flex items-center space-x-1.5">
              {scanResultItem.status === 'in_stock' && (
                <button
                  type="button"
                  onClick={() => handleOpenItemForUse(scanResultItem)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                >
                   เปิดใช้งานเดี๋ยวนี้
                </button>
              )}
              {scanResultItem.status === 'in_use' && (
                <button
                  type="button"
                  onClick={() => handleMarkDepleted(scanResultItem)}
                  className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-[11px] cursor-pointer"
                >
                   ตัดยอดหมดแล้ว
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedItemForPrint(scanResultItem.itemCode);
                  setIsBarcodePrinterOpen(true);
                }}
                className="px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] cursor-pointer"
              >
                ️ พิมพ์ 50x20
              </button>
              <button
                type="button"
                onClick={() => setScanResultItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 hidden lg:inline">
            รองรับเครื่องสแกนบาร์โค้ด USB / Bluetooth ทุกรุ่น (ยิงแล้วกด Enter อัตโนมัติ)
          </span>
        )}
      </div>

      {/* NAVIGATION TABS: Clean, Modern, Medical Layout */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto text-xs font-black">
        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'inventory'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <TableIcon size={15} />
          <span>สต็อกคงเหลือ & กำลังใช้งาน ({items.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('receive')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'receive'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Plus size={15} />
          <span>รับเข้าพัสดุใหม่ (Receive Stock)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'history'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <History size={15} />
          <span>ประวัติรับเข้า - เบิกจ่าย ({movementHistory.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('print')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'print'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Printer size={15} />
          <span>พิมพ์สติกเกอร์ Zebra (50x20 mm)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('battery')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'battery'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Battery size={15} className="text-amber-500" />
          <span>ประวัติเบิกถ่านเครื่องตรวจ ({batteryDisbursements.length})</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: INVENTORY (สต็อกคงเหลือ & รายการใช้งาน)
      ========================================================================= */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหารหัสกล่อง (ST-...), LOT Number, ยี่ห้อ..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFilterCategory('all')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    filterCategory === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('strip')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                    filterCategory === 'strip' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Droplet size={12} />
                  <span>แผ่นตรวจ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('control_solution')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                    filterCategory === 'control_solution' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FlaskConical size={12} />
                  <span>น้ำยาควบคุม</span>
                </button>
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="all">ทุกสถานะ</option>
                <option value="in_stock">ยังไม่เปิดใช้งาน (In Stock)</option>
                <option value="in_use">กำลังใช้งานในแล็บ (In Use)</option>
                <option value="depleted">ใช้งานหมดแล้ว (Depleted)</option>
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

          {/* Table or Cards Display */}
          {filteredItems.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Package size={28} />
              </div>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {items.length === 0 ? 'ยังไม่มีข้อมูลพัสดุในฐานข้อมูล Supabase' : 'ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา'}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {items.length === 0 
                  ? 'คุณสามารถกดปุ่ม "รับเข้าพัสดุใหม่" เพื่อบันทึกข้อมูล LOT และสร้างบาร์โค้ดสติกเกอร์ Zebra รายกล่องได้ทันที' 
                  : 'ลองเปลี่ยนคำค้นหา หรือรีเซ็ตตัวกรองด้านบน'}
              </p>
              {items.length === 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('receive')}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center space-x-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <Plus size={15} />
                  <span>+ รับเข้าพัสดุกล่องแรก</span>
                </button>
              )}
            </div>
          ) : viewMode === 'table' ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                      <th className="p-3.5 pl-5">รหัสกล่อง/ขวด (Unit ID)</th>
                      <th className="p-3.5">บาร์โค้ด Code128</th>
                      <th className="p-3.5">ประเภท</th>
                      <th className="p-3.5">LOT Number</th>
                      <th className="p-3.5">วันหมดอายุ (EXP)</th>
                      <th className="p-3.5">สถานะ</th>
                      <th className="p-3.5">วันที่เปิด / ข้อมูลการใช้</th>
                      <th className="p-3.5 pr-5 text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredItems.map(item => (
                      <tr 
                        key={item.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="p-3.5 pl-5">
                          <div className="font-mono font-black text-slate-900 dark:text-white">
                            {item.itemCode}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            กล่องที่ {item.boxIndex || 1}/{item.totalBoxes || 1}
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
                              : 'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800'
                          }`}>
                            {item.itemType === 'strip' ? <Droplet size={11} /> : <FlaskConical size={11} />}
                            <span>{item.itemType === 'strip' ? 'แผ่นตรวจ (Strip)' : 'น้ำยาควบคุม (QC)'}</span>
                          </span>
                        </td>

                        <td className="p-3.5">
                          <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {item.lotNumber}
                          </div>
                          <span className="text-[10px] text-slate-400">{item.manufacturer || 'VivaChek'}</span>
                        </td>

                        <td className="p-3.5">
                          <div className="font-mono text-slate-700 dark:text-slate-300 font-bold">
                            {item.expDate ? formatThaiDateOnly(item.expDate) : '-'}
                          </div>
                          {item.openExpDate && item.status === 'in_use' && (
                            <span className="text-[10px] text-amber-600 block font-bold">
                              หมดอายุหลังเปิด: {formatThaiDateOnly(item.openExpDate)}
                            </span>
                          )}
                        </td>

                        <td className="p-3.5">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            item.status === 'in_stock' 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                            item.status === 'in_use' 
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                              'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {item.status === 'in_stock' ? 'ยังไม่เปิด' : item.status === 'in_use' ? 'กำลังใช้งาน' : 'ใช้หมดแล้ว'}
                          </span>
                        </td>

                        <td className="p-3.5 text-slate-600 dark:text-slate-400">
                          {item.status === 'in_use' && (
                            <div>
                              <span className="text-[11px] block font-bold text-slate-800 dark:text-slate-200">
                                เปิด: {item.openDate ? formatThaiDateOnly(item.openDate) : '-'}
                              </span>
                              <span className="text-[10px] text-slate-400">โดย: {item.openedBy || 'ห้องแล็บ'}</span>
                            </div>
                          )}
                          {item.status === 'in_stock' && (
                            <span className="text-[11px] text-slate-400">รับเข้า: {formatThaiDateOnly(item.receivedDate)}</span>
                          )}
                          {item.status === 'depleted' && (
                            <span className="text-[11px] text-slate-400">{item.notes || 'ตัดสต็อกแล้ว'}</span>
                          )}
                        </td>

                        <td className="p-3.5 pr-5 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {item.status === 'in_stock' && (
                              <button
                                type="button"
                                onClick={() => handleOpenItemForUse(item)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10.5px] cursor-pointer shadow-xs transition-colors"
                                title="เปิดขวดใช้งานในแล็บ"
                              >
                                เปิดใช้
                              </button>
                            )}

                            {item.status === 'in_use' && (
                              <button
                                type="button"
                                onClick={() => handleMarkDepleted(item)}
                                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10.5px] cursor-pointer shadow-xs transition-colors"
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
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sky-600 cursor-pointer transition-colors"
                              title="พิมพ์สติกเกอร์ Zebra 50x20 mm"
                            >
                              <Printer size={14} />
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
                              onClick={() => handleDeleteItem(item.id)}
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
            /* Cards View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map(item => (
                <div 
                  key={item.id}
                  className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        item.itemType === 'strip' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-sky-50 text-sky-700 border border-sky-200'
                      }`}>
                        {item.itemType === 'strip' ? <Droplet size={10} /> : <FlaskConical size={10} />}
                        <span>{item.itemType === 'strip' ? 'แผ่นตรวจ' : 'น้ำยาควบคุม'}</span>
                      </span>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.status === 'in_stock' ? 'bg-emerald-100 text-emerald-800' :
                        item.status === 'in_use' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {item.status === 'in_stock' ? 'ยังไม่เปิด' : item.status === 'in_use' ? 'กำลังใช้งาน' : 'ใช้หมดแล้ว'}
                      </span>
                    </div>

                    <div>
                      <div className="font-mono text-base font-black text-slate-900 dark:text-white">
                        {item.itemCode}
                      </div>
                      <div className="text-xs text-slate-500 font-bold">
                        LOT: {item.lotNumber} | EXP: {item.expDate ? formatThaiDateOnly(item.expDate) : '-'}
                      </div>
                    </div>

                    <div className="py-1">
                      <Code128Barcode text={item.itemCode} height={24} barWidth={1.1} showText={false} />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItemForPrint(item.itemCode);
                        setIsBarcodePrinterOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 font-bold text-xs flex items-center space-x-1 cursor-pointer"
                    >
                      <Printer size={13} />
                      <span>50x20 mm</span>
                    </button>

                    <div className="flex items-center space-x-1.5">
                      {item.status === 'in_stock' && (
                        <button
                          type="button"
                          onClick={() => handleOpenItemForUse(item)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                        >
                          เปิดใช้
                        </button>
                      )}
                      {item.status === 'in_use' && (
                        <button
                          type="button"
                          onClick={() => handleMarkDepleted(item)}
                          className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer"
                        >
                          ตัดยอดหมด
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: RECEIVE STOCK (รับเข้าพัสดุใหม่ & Auto Generate Barcode)
      ========================================================================= */}
      {activeTab === 'receive' && (
        <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/20">
              <Plus size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                ฟอร์มรับเข้าพัสดุใหม่ (Inbound Reagent / Strip Receiving)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ระบบจะสร้างรหัส Unique Barcode รายกล่อง (Code128) อัตโนมัติ พร้อมส่งไปยังแท่นพิมพ์ Zebra 50x20 mm
              </p>
            </div>
          </div>

          <form onSubmit={handleReceiveStockSubmit} className="space-y-5 text-xs">
            {/* Category selection */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">ประเภทพัสดุที่รับเข้า:</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setReceiveForm(prev => ({ ...prev, category: 'strip' }))}
                  className={`p-3.5 rounded-2xl border text-left font-bold transition-all flex items-center space-x-3 cursor-pointer ${
                    receiveForm.category === 'strip'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Droplet size={20} className={receiveForm.category === 'strip' ? 'text-emerald-600' : 'text-slate-400'} />
                  <div>
                    <div className="font-black text-sm">แผ่นตรวจน้ำตาล (Test Strip)</div>
                    <div className="text-[11px] font-normal text-slate-500">รหัสขึ้นต้น ST- (เช่น ST-LOT2026A-01)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setReceiveForm(prev => ({ ...prev, category: 'control_solution' }))}
                  className={`p-3.5 rounded-2xl border text-left font-bold transition-all flex items-center space-x-3 cursor-pointer ${
                    receiveForm.category === 'control_solution'
                      ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-500 text-sky-800 dark:text-sky-300 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <FlaskConical size={20} className={receiveForm.category === 'control_solution' ? 'text-sky-600' : 'text-slate-400'} />
                  <div>
                    <div className="font-black text-sm">น้ำยาควบคุมคุณภาพ (Control Solution)</div>
                    <div className="text-[11px] font-normal text-slate-500">รหัสขึ้นต้น QC- (เช่น QC-LOT2026A-01)</div>
                  </div>
                </button>
              </div>
            </div>

            {/* LOT & Quantity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  หมายเลข LOT ข้างกล่อง <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={receiveForm.lotNumber}
                  onChange={(e) => setReceiveForm(prev => ({ ...prev, lotNumber: e.target.value }))}
                  placeholder="เช่น 2026A หรือ LOT2026-A"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold dark:text-white uppercase outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  จำนวนกล่อง / ขวด ที่รับเข้า <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  required
                  value={receiveForm.boxCount}
                  onChange={(e) => setReceiveForm(prev => ({ ...prev, boxCount: Math.max(1, Number(e.target.value)) }))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-400">
                  ระบบจะสร้างบาร์โค้ด {receiveForm.boxCount} รหัส ({receiveForm.category === 'strip' ? 'ST' : 'QC'}-{receiveForm.lotNumber || 'LOT'}-01 ถึง {receiveForm.boxCount < 10 ? `0${receiveForm.boxCount}` : receiveForm.boxCount})
                </span>
              </div>
            </div>

            {/* Dates & Manufacturer */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">วันที่รับเข้า:</label>
                <input
                  type="date"
                  value={receiveForm.receivedDate}
                  onChange={(e) => setReceiveForm(prev => ({ ...prev, receivedDate: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  วันหมดอายุข้างกล่อง (EXP) <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="date"
                  required
                  value={receiveForm.expDate}
                  onChange={(e) => setReceiveForm(prev => ({ ...prev, expDate: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">ยี่ห้อ / ผู้ผลิต:</label>
                <input
                  type="text"
                  value={receiveForm.manufacturer}
                  onChange={(e) => setReceiveForm(prev => ({ ...prev, manufacturer: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-bold"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">หมายเหตุเพิ่มเติม:</label>
              <input
                type="text"
                value={receiveForm.notes}
                onChange={(e) => setReceiveForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="เช่น ใบส่งของเลขที่..., สั่งซื้อล็อตพิเศษ"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Action Submit */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setActiveTab('inventory')}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ยกเลิก
              </button>

              <button
                type="submit"
                disabled={isSubmittingReceive}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center space-x-2 cursor-pointer shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
              >
                <Save size={16} />
                <span>{isSubmittingReceive ? 'กำลังบันทึกลงฐานข้อมูล...' : 'บันทึกรับเข้า & เปิดพิมพ์สติกเกอร์ Zebra'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          TAB 3: MOVEMENT & USAGE HISTORY (ประวัติรับเข้า - เบิกจ่าย)
      ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center space-x-2">
                  <History size={16} className="text-emerald-600" />
                  <span>บันทึกประวัติการรับเข้าและการเปิดใช้งานพัสดุในห้องแล็บ</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  ไทม์ไลน์การเคลื่อนไหวของแผ่นตรวจและน้ำยาควบคุม (วันรับเข้า, วันเปิดใช้, วันหมดอายุจริง)
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500">
                ทั้งหมด {movementHistory.length} รายการ
              </span>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3.5 pl-5">รหัสกล่อง/ขวด</th>
                    <th className="p-3.5">ประเภท</th>
                    <th className="p-3.5">LOT</th>
                    <th className="p-3.5">วันที่รับเข้า</th>
                    <th className="p-3.5">วันที่เปิดใช้งาน</th>
                    <th className="p-3.5">วันหมดอายุหลังเปิด (Open EXP)</th>
                    <th className="p-3.5">สถานะปัจจุบัน</th>
                    <th className="p-3.5 pr-5">ผู้ดำเนินการ / บันทึก</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {movementHistory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        ยังไม่มีประวัติการเคลื่อนไหว
                      </td>
                    </tr>
                  ) : (
                    movementHistory.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3.5 pl-5 font-mono font-bold text-slate-900 dark:text-white">
                          {item.itemCode}
                        </td>
                        <td className="p-3.5">
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.itemType === 'strip' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'
                          }`}>
                            <span>{item.itemType === 'strip' ? 'แผ่นตรวจ' : 'น้ำยาควบคุม'}</span>
                          </span>
                        </td>
                        <td className="p-3.5 font-mono font-bold">{item.lotNumber}</td>
                        <td className="p-3.5">{formatThaiDateOnly(item.receivedDate)}</td>
                        <td className="p-3.5">
                          {item.openDate ? (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {formatThaiDateOnly(item.openDate)}
                            </span>
                          ) : (
                            <span className="text-slate-400">ยังไม่เปิดใช้งาน</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          {item.openExpDate ? (
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              {formatThaiDateOnly(item.openExpDate)}
                            </span>
                          ) : (
                            <span className="text-slate-400">{formatThaiDateOnly(item.expDate)} (ตามฉลาก)</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === 'in_stock' ? 'bg-emerald-100 text-emerald-800' :
                            item.status === 'in_use' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {item.status === 'in_stock' ? 'พร้อมใช้' : item.status === 'in_use' ? 'กำลังใช้งาน' : 'ใช้หมดแล้ว'}
                          </span>
                        </td>
                        <td className="p-3.5 pr-5 text-slate-500">
                          {item.openedBy || item.notes || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: BARCODE PRINTING CENTER (Zebra 50x20 mm)
      ========================================================================= */}
      {activeTab === 'print' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  ศูนย์พิมพ์สติกเกอร์บาร์โค้ด Zebra (50x20 mm)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                  Thermal Direct
                </span>
              </div>
              <p className="text-xs text-slate-500">
                ขนาด 50x20 มม. มาตรฐานห้องปฏิบัติการ รองรับเครื่องพิมพ์ Zebra ZD220, ZD230, GK420t และเครื่องพิมพ์ความร้อนทุกรุ่น
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedItemForPrint(undefined);
                setIsBarcodePrinterOpen(true);
              }}
              className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs flex items-center space-x-2 cursor-pointer shadow-md shadow-sky-600/20"
            >
              <Printer size={16} />
              <span>เปิดกล่องตั้งค่าการพิมพ์ขั้นสูง</span>
            </button>
          </div>

          {/* Quick Selection by LOT */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              เลือกพิมพ์ตาม LOT ที่มีในระบบ:
            </h4>

            {lotConfigs.length === 0 && items.length === 0 ? (
              <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl text-center text-xs text-slate-400">
                ยังไม่มีข้อมูล LOT ในระบบ กรุณารับเข้าพัสดุก่อน
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from(new Set(items.map(i => i.lotNumber))).map(lot => {
                  const lotItems = items.filter(i => i.lotNumber === lot);
                  const first = lotItems[0];
                  return (
                    <div 
                      key={lot} 
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm font-black text-slate-900 dark:text-white">
                            LOT: {lot}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                            {lotItems.length} กล่อง
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          EXP: {first?.expDate ? formatThaiDateOnly(first.expDate) : '-'} • {first?.manufacturer || 'VivaChek'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLotForPrint(lot);
                          setIsBarcodePrinterOpen(true);
                        }}
                        className="w-full py-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        <Printer size={14} />
                        <span>พิมพ์สติกเกอร์ LOT นี้ (50x20 mm)</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: BATTERY DISBURSEMENTS (ประวัติการเบิกถ่านเครื่องตรวจ)
      ========================================================================= */}
      {activeTab === 'battery' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center space-x-2">
                  <Battery size={16} className="text-amber-500" />
                  <span>บันทึกการเบิกถ่านสำหรับเครื่องตรวจน้ำตาล DTX ประจำตึก/หน่วยงาน</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  ประวัติการแจกจ่ายถ่าน (AAA / CR2032) ให้แก่ตึกผู้ป่วยเพื่อบำรุงรักษาเครื่อง DTX
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsDisburseModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-md shadow-amber-600/20"
              >
                <Plus size={15} />
                <span>+ บันทึกการเบิกถ่านใหม่</span>
              </button>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3.5 pl-5">วันที่เบิก</th>
                    <th className="p-3.5">หน่วยงาน/ตึก</th>
                    <th className="p-3.5">เครื่อง DTX (S/N)</th>
                    <th className="p-3.5">ชนิดถ่าน</th>
                    <th className="p-3.5">จำนวน</th>
                    <th className="p-3.5">ผู้ขอเบิก</th>
                    <th className="p-3.5">ผู้จ่าย (แล็บ)</th>
                    <th className="p-3.5 pr-5 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {batteryDisbursements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        ยังไม่มีประวัติการเบิกถ่าน
                      </td>
                    </tr>
                  ) : (
                    batteryDisbursements.map(b => (
                      <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3.5 pl-5 font-bold">{formatThaiDateOnly(b.date)}</td>
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">{b.ward}</td>
                        <td className="p-3.5 font-mono">{b.serialNumber || b.bgmCode || '-'}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                            {b.batteryType}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold">{b.quantity} ก้อน</td>
                        <td className="p-3.5">{b.requesterName}</td>
                        <td className="p-3.5 text-slate-500">{b.dispenserName || 'แล็บ'}</td>
                        <td className="p-3.5 pr-5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteDisbursement(b.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600"
                            title="ลบรายการ"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS & DIALOGS
      ========================================================================= */}

      {/* 1. Barcode Printer Modal (Zebra 50x20 mm & ZPL Code) */}
      <BarcodePrinterModal
        isOpen={isBarcodePrinterOpen}
        onClose={() => setIsBarcodePrinterOpen(false)}
        stockItems={items}
        lotConfigs={lotConfigs}
        machines={machines}
        initialSource={selectedLotForPrint ? 'lot' : 'stock'}
        initialItemCode={selectedItemForPrint}
        initialLotNumber={selectedLotForPrint}
      />

      {/* 2. Battery Disbursement Modal */}
      {isDisburseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
                <BatteryCharging size={18} className="text-amber-500" />
                <span>บันทึกการเบิกถ่านเครื่องตรวจ DTX</span>
              </h3>
              <button onClick={() => setIsDisburseModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDisburseBattery} className="space-y-3.5">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">ตึก / หน่วยงานที่ขอเบิก *:</label>
                <input
                  type="text"
                  required
                  value={disburseForm.ward}
                  onChange={(e) => setDisburseForm(prev => ({ ...prev, ward: e.target.value }))}
                  placeholder="เช่น หอผู้ป่วยอายุรกรรมหญิง, ER"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">ชนิดถ่าน:</label>
                  <select
                    value={disburseForm.batteryType}
                    onChange={(e) => setDisburseForm(prev => ({ ...prev, batteryType: e.target.value as any }))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-bold"
                  >
                    <option value="AAA">ถ่าน AAA (2 ก้อน)</option>
                    <option value="AA">ถ่าน AA</option>
                    <option value="CR2032">ถ่านกระดุม CR2032</option>
                    <option value="other">อื่นๆ</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">จำนวนที่เบิก (ก้อน):</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={disburseForm.quantity}
                    onChange={(e) => setDisburseForm(prev => ({ ...prev, quantity: Math.max(1, Number(e.target.value)) }))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">ชื่อผู้ขอเบิก *:</label>
                  <input
                    type="text"
                    required
                    value={disburseForm.requesterName}
                    onChange={(e) => setDisburseForm(prev => ({ ...prev, requesterName: e.target.value }))}
                    placeholder="ชื่อพยาบาล / เจ้าหน้าที่"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">เครื่อง DTX (S/N หรือ BGM Code):</label>
                  <input
                    type="text"
                    value={disburseForm.serialNumber}
                    onChange={(e) => setDisburseForm(prev => ({ ...prev, serialNumber: e.target.value }))}
                    placeholder="เช่น BGM-01"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">เหตุผลในการเบิก:</label>
                <input
                  type="text"
                  value={disburseForm.reason}
                  onChange={(e) => setDisburseForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsDisburseModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black"
                >
                  บันทึกการเบิกถ่าน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                แก้ไขข้อมูลพัสดุ: {editingItem.itemCode}
              </h3>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">รหัสพัสดุ (Unit Barcode):</label>
                <input
                  type="text"
                  value={editingItem.itemCode}
                  onChange={(e) => setEditingItem({ ...editingItem, itemCode: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">LOT Number:</label>
                <input
                  type="text"
                  value={editingItem.lotNumber}
                  onChange={(e) => setEditingItem({ ...editingItem, lotNumber: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">วันหมดอายุ:</label>
                  <input
                    type="date"
                    value={editingItem.expDate}
                    onChange={(e) => setEditingItem({ ...editingItem, expDate: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">สถานะ:</label>
                  <select
                    value={editingItem.status}
                    onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value as any })}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-bold"
                  >
                    <option value="in_stock">ยังไม่เปิดใช้งาน (In Stock)</option>
                    <option value="in_use">กำลังใช้งานในแล็บ (In Use)</option>
                    <option value="depleted">ใช้งานหมดแล้ว (Depleted)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">หมายเหตุ:</label>
                <input
                  type="text"
                  value={editingItem.notes || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
