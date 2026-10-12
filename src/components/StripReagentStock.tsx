/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { QcLotConfig, StripReagentItem, DtxMachine, SupplyRequest, BatteryDisbursementRecord } from '../types';
import { dbService } from '../lib/supabase';
import { getThaiTodayDateOnly, formatThaiDateOnly } from '../lib/dateUtils';
import { BarcodePrinterModal } from './BarcodePrinterModal';
import { 
  Package, Search, Filter, Layers, Clock, AlertTriangle, 
  CheckCircle2, Barcode, Sparkles, Droplet, FlaskConical, 
  Calendar, Building2, User, ChevronRight, RefreshCw, FileText,
  Plus, Edit2, Trash2, X, SlidersHorizontal, Calculator, Save, Info, Zap, Camera, QrCode, Play,
  Table as TableIcon, LayoutGrid, Printer, Download, Battery, BatteryCharging
} from 'lucide-react';

interface StripReagentStockProps {
  lotConfigs: QcLotConfig[];
  supplies?: SupplyRequest[];
  machines?: DtxMachine[];
  onUpdateLotConfigs?: (configs: QcLotConfig[]) => void;
}

// Simple Barcode SVG visualizer component (Code128 style visual)
function BarcodeSvg({ text, height = 36, width = 160 }: { text: string; height?: number; width?: number }) {
  // Generate deterministic pattern based on characters
  const bars = useMemo(() => {
    let pattern = '';
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      pattern += (code % 2 === 0 ? '1101' : '1011') + (code % 3 === 0 ? '0' : '1');
    }
    // ensure starts and ends with guard bar
    pattern = '101' + pattern + '101';
    return pattern;
  }, [text]);

  const barWidth = width / bars.length;

  return (
    <div className="flex flex-col items-center select-none bg-white p-1.5 rounded-lg border border-slate-200 inline-block shadow-2xs">
      <svg width={width} height={height} className="overflow-visible">
        {bars.split('').map((bit, idx) => (
          bit === '1' ? (
            <rect 
              key={idx} 
              x={idx * barWidth} 
              y={0} 
              width={Math.max(1, barWidth - 0.2)} 
              height={height} 
              fill="#0f172a" 
            />
          ) : null
        ))}
      </svg>
      <span className="text-[10px] font-mono font-black text-slate-800 tracking-wider mt-0.5 leading-none">
        {text}
      </span>
    </div>
  );
}

export default function StripReagentStock({
  lotConfigs,
  supplies = [],
  machines = [],
  onUpdateLotConfigs
}: StripReagentStockProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'strip' | 'control_solution' | 'battery'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_stock' | 'in_use' | 'depleted'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table'); // Default to Raw Data Table
  const [activeTab, setActiveTab] = useState<'items' | 'lots' | 'barcode_sheet' | 'batteries'>('items');

  // Items State (Individual box/bottle tracking)
  const [items, setItems] = useState<StripReagentItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Battery Disbursement & Tracking State
  const [batteryDisbursements, setBatteryDisbursements] = useState<BatteryDisbursementRecord[]>([]);
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);
  const [batterySubView, setBatterySubView] = useState<'disbursements' | 'inventory'>('disbursements');
  const [batterySearch, setBatterySearch] = useState('');
  const [batteryWardFilter, setBatteryWardFilter] = useState('all');
  const [batteryTypeFilter, setBatteryTypeFilter] = useState<'all' | 'AAA' | 'AA' | 'CR2032' | 'other'>('all');

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

  // Modal State for Adding / Inbound Batch Entry
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string>('');

  // Individual item edit state
  const [editingItem, setEditingItem] = useState<StripReagentItem | null>(null);

  // Barcode Printer Modal States
  const [isBarcodePrinterOpen, setIsBarcodePrinterOpen] = useState<boolean>(false);
  const [barcodePrinterSource, setBarcodePrinterSource] = useState<'stock' | 'lot' | 'machines' | 'custom'>('stock');
  const [selectedItemCodeForPrint, setSelectedItemCodeForPrint] = useState<string | undefined>(undefined);
  const [selectedLotForPrint, setSelectedLotForPrint] = useState<string | undefined>(undefined);

  const initialFormState = {
    category: 'strip' as 'strip' | 'control_solution' | 'battery',
    batteryType: 'AAA' as 'AAA' | 'AA' | 'CR2032' | 'other',
    lotNumber: '',
    barcode: '',
    manufacturer: 'VivaChek Fad',
    boxCount: 5, // จำนวนกล่อง/แพ็คที่รับเข้าเพื่อ Auto-gen Item Codes
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

  const [formData, setFormData] = useState(initialFormState);

  // Fetch individual strip items from Supabase
  const loadItems = async () => {
    setIsLoadingItems(true);
    try {
      const dbItems = await dbService.getStripReagentItems();
      if (Array.isArray(dbItems) && dbItems.length > 0) {
        setItems(dbItems);
      } else {
        const localSaved = localStorage.getItem('dtx_strip_items');
        if (localSaved) {
          setItems(JSON.parse(localSaved));
        } else {
          setItems([]);
        }
      }
    } catch (e) {
      console.warn('Load strip items notice:', e);
    } finally {
      setIsLoadingItems(false);
    }
  };

  const loadBatteryData = async () => {
    try {
      const list = await dbService.getBatteryDisbursements();
      setBatteryDisbursements(list);
    } catch (e) {
      console.warn('loadBatteryData error:', e);
    }
  };

  useEffect(() => {
    loadItems();
    loadBatteryData();
  }, []);

  const saveItemsState = async (newItems: StripReagentItem[]) => {
    setItems(newItems);
    localStorage.setItem('dtx_strip_items', JSON.stringify(newItems));
  };

  // Show auto toast
  const showToastNotification = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const handleSaveEditedItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      await dbService.updateStripReagentItem(editingItem.id, editingItem);
      const newItems = items.map(item => item.id === editingItem.id ? { ...item, ...editingItem } : item);
      await saveItemsState(newItems);
      showToastNotification('✓ แก้ไขข้อมูลพัสดุสำเร็จเรียบร้อยแล้ว!');
      setEditingItem(null);
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ที่จะลบรายการพัสดุนี้ออกจากคลัง? การลบไม่สามารถย้อนคืนได้')) {
      return;
    }

    try {
      await dbService.deleteStripReagentItem(id);
      const newItems = items.filter(item => item.id !== id);
      await saveItemsState(newItems);
      showToastNotification('✓ ลบรายการพัสดุออกจากคลังเรียบร้อยแล้ว!');
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการลบข้อมูล: ' + err.message);
    }
  };

  // Open modal for inbound
  const handleOpenAddModal = () => {
    setFormData(initialFormState);
    setIsModalOpen(true);
  };

  // Handle Inbound Form Submit (Auto-Generate Unique Item Codes)
  const handleSubmitInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lotNumber.trim()) {
      alert('กรุณาระบุเลข LOT Number');
      return;
    }
    if (!formData.expDate) {
      alert('กรุณาระบุวันหมดอายุ (Exp Date)');
      return;
    }

    const cleanLot = formData.lotNumber.trim().toUpperCase();
    const count = Math.max(1, Number(formData.boxCount) || 1);
    const prefix = formData.category === 'control_solution' ? 'CTRL' : (formData.category === 'battery' ? `BAT-${formData.batteryType || 'AAA'}` : 'ST');

    // Find existing count for this lot to continue serial numbering
    const existingLotItems = items.filter(i => i.lotNumber.toUpperCase() === cleanLot);
    const startIdx = existingLotItems.length + 1;

    const newGeneratedItems: StripReagentItem[] = [];
    for (let i = 0; i < count; i++) {
      const currentIdx = startIdx + i;
      const indexStr = currentIdx < 10 ? `0${currentIdx}` : `${currentIdx}`;
      const itemCode = `${prefix}-${cleanLot}-${indexStr}`;
      
      newGeneratedItems.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${i}`,
        itemCode,
        lotNumber: cleanLot,
        manufacturer: formData.manufacturer.trim(),
        itemType: formData.category,
        batteryType: formData.category === 'battery' ? (formData.batteryType || 'AAA') : undefined,
        receivedDate: formData.receivedDate,
        expDate: formData.expDate,
        status: 'in_stock',
        notes: formData.notes,
        boxIndex: currentIdx,
        totalBoxes: count
      });
    }

    // Also update / insert QC Lot Config if not exists (only for strips/control)
    if (formData.category !== 'battery') {
      const lotExists = lotConfigs.some(c => c.lotNumber.toUpperCase() === cleanLot);
      let updatedLotConfigs = [...lotConfigs];
      if (!lotExists) {
        const newConfig: QcLotConfig = {
          lotNumber: cleanLot,
          barcode: formData.barcode.trim(),
          manufacturer: formData.manufacturer.trim(),
          testsPerBox: Number(formData.testsPerBox) || 50,
          receivedDate: formData.receivedDate,
          expDate: formData.expDate,
          openExpDays: Number(formData.openExpDays) || 90,
          notes: formData.notes,
          level1Target: Number(formData.level1Target),
          level1Min: Number(formData.level1Min),
          level1Max: Number(formData.level1Max),
          level1SD: Number(formData.level1SD),
          level2Target: Number(formData.level2Target),
          level2Min: Number(formData.level2Min),
          level2Max: Number(formData.level2Max),
          level2SD: Number(formData.level2SD),
          level3Target: Number(formData.level3Target),
          level3Min: Number(formData.level3Min),
          level3Max: Number(formData.level3Max),
          level3SD: Number(formData.level3SD),
        };
        updatedLotConfigs = [newConfig, ...lotConfigs];
        if (onUpdateLotConfigs) onUpdateLotConfigs(updatedLotConfigs);
        try {
          await dbService.insertLotConfig(newConfig);
        } catch (e) {}
      }
    }

    // Insert items to Supabase & Local state
    try {
      await dbService.insertStripReagentItems(newGeneratedItems);
    } catch (e) {
      console.warn('Insert strip items DB notice:', e);
    }

    const mergedItems = [...newGeneratedItems, ...items];
    await saveItemsState(mergedItems);

    const unitLabel = formData.category === 'battery' ? 'ก้อน' : 'กล่อง';
    showToastNotification(`รับเข้าพัสดุ ${count} ${unitLabel} (LOT: ${cleanLot}) พร้อมสร้างบาร์โค้ดสำเร็จ`);
    setIsModalOpen(false);
  };

  // Battery Disbursement Handlers
  const handleSubmitDisburse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disburseForm.ward.trim()) {
      alert('กรุณาระบุหน่วยงาน');
      return;
    }
    if (!disburseForm.requesterName.trim()) {
      alert('กรุณาระบุชื่อผู้ขอเบิก');
      return;
    }

    const newRec: BatteryDisbursementRecord = {
      id: `BAT-DIS-${Date.now()}`,
      date: getThaiTodayDateOnly(),
      ward: disburseForm.ward.trim(),
      bgmCode: disburseForm.bgmCode.trim() || undefined,
      serialNumber: disburseForm.serialNumber.trim() || undefined,
      batteryType: disburseForm.batteryType,
      quantity: Math.max(1, Number(disburseForm.quantity) || 2),
      requesterName: disburseForm.requesterName.trim(),
      dispenserName: disburseForm.dispenserName.trim() || 'เจ้าหน้าที่ห้องแล็บ',
      reason: disburseForm.reason.trim() || 'ถ่านหมด/เปลี่ยนถ่าน',
      status: 'dispensed',
      notes: disburseForm.notes.trim() || undefined
    };

    try {
      await dbService.insertBatteryDisbursement(newRec);
      setBatteryDisbursements(prev => [newRec, ...prev]);

      // Automatically deplete physical in-stock batteries if available
      const matchingBatteries = items.filter(
        i => i.itemType === 'battery' && 
        i.status === 'in_stock' && 
        (i.batteryType === disburseForm.batteryType || (!i.batteryType && disburseForm.batteryType === 'AAA'))
      );
      if (matchingBatteries.length > 0) {
        const qtyToDeplete = Math.min(matchingBatteries.length, Number(disburseForm.quantity) || 2);
        const today = getThaiTodayDateOnly();
        let updatedItems = [...items];
        for (let i = 0; i < qtyToDeplete; i++) {
          const itm = matchingBatteries[i];
          const depletedItem: StripReagentItem = {
            ...itm,
            status: 'depleted',
            lastUsedDate: today
          };
          await dbService.updateStripReagentItem(itm.id, depletedItem).catch(() => {});
          updatedItems = updatedItems.map(x => x.id === itm.id ? depletedItem : x);
        }
        await saveItemsState(updatedItems);
      }

      showToastNotification(`✓ บันทึกการเบิกถ่าน ${disburseForm.batteryType} จำนวน ${disburseForm.quantity} ก้อน ให้กับ ${disburseForm.ward} เรียบร้อยแล้ว`);
      setIsDisburseModalOpen(false);
      setDisburseForm(prev => ({
        ...prev,
        bgmCode: '',
        serialNumber: '',
        requesterName: '',
        notes: ''
      }));
    } catch (err: any) {
      console.error(err);
      alert(`เกิดข้อผิดพลาดในการบันทึกการเบิกถ่าน: ${err?.message || err}`);
    }
  };

  const handleDeleteDisbursement = async (id: string) => {
    if (!window.confirm('ยืนยันลบรายการประวัติการเบิกถ่านนี้?')) return;
    try {
      await dbService.deleteBatteryDisbursement(id);
      setBatteryDisbursements(prev => prev.filter(r => r.id !== id));
      showToastNotification('✓ ลบประวัติการเบิกถ่านเรียบร้อยแล้ว');
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการลบ: ${err?.message || err}`);
    }
  };

  // Lab Dispense / Open 1 Bottle/Box Action
  const handleOpenItemForLabUse = async (item: StripReagentItem) => {
    const today = getThaiTodayDateOnly();
    
    // Calculate open exp date (+90 days default)
    const openExpDays = 90;
    const [y, m, d] = today.split('-').map(Number);
    const openExpDateObj = new Date(y, m - 1, d + openExpDays);
    const expY = openExpDateObj.getFullYear();
    const expM = String(openExpDateObj.getMonth() + 1).padStart(2, '0');
    const expD = String(openExpDateObj.getDate()).padStart(2, '0');
    const openExpDate = `${expY}-${expM}-${expD}`;

    const updatedItem: StripReagentItem = {
      ...item,
      status: 'in_use',
      openDate: today,
      openExpDate: openExpDate,
      openedBy: 'เจ้าหน้าที่ห้องแล็บ'
    };

    try {
      await dbService.updateStripReagentItem(item.id, {
        status: 'in_use',
        openDate: today,
        openExpDate: openExpDate,
        openedBy: 'เจ้าหน้าที่ห้องแล็บ'
      });
    } catch (e) {}

    const newItems = items.map(i => i.id === item.id ? updatedItem : i);
    await saveItemsState(newItems);

    showToastNotification(`เปิดใช้งานกล่อง ${item.itemCode} ในแล็บแล้ว (หมดอายุหลังเปิด: ${openExpDate})`);
  };

  // Mark Item as Depleted (หมดแล้ว)
  const handleMarkAsDepleted = async (item: StripReagentItem) => {
    if (!confirm(`ยืนยันบันทึกกล่อง/ขวด ${item.itemCode} ว่าใช้งานหมดแล้ว (Depleted)?`)) return;

    const updatedItem: StripReagentItem = {
      ...item,
      status: 'depleted'
    };

    try {
      await dbService.updateStripReagentItem(item.id, {
        status: 'depleted'
      });
    } catch (e) {}

    const newItems = items.map(i => i.id === item.id ? updatedItem : i);
    await saveItemsState(newItems);

    showToastNotification(`บันทึกกล่อง ${item.itemCode} ใช้งานหมดแล้ว`);
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesCategory = filterCategory === 'all' || item.itemType === filterCategory;
      const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
      const matchesSearch = !searchTerm.trim() || 
        item.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.manufacturer && item.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [items, filterCategory, filterStatus, searchTerm]);

  // Group items by LOT for LOT Overview tab
  const lotSummaryList = useMemo(() => {
    const lotMap = new Map<string, {
      lotNumber: string;
      itemType: string;
      manufacturer?: string;
      expDate: string;
      totalReceived: number;
      inStock: number;
      inUse: number;
      depleted: number;
    }>();

    items.forEach(i => {
      const key = i.lotNumber;
      if (!lotMap.has(key)) {
        lotMap.set(key, {
          lotNumber: i.lotNumber,
          itemType: i.itemType,
          manufacturer: i.manufacturer,
          expDate: i.expDate,
          totalReceived: 0,
          inStock: 0,
          inUse: 0,
          depleted: 0
        });
      }
      const data = lotMap.get(key)!;
      data.totalReceived += 1;
      if (i.status === 'in_stock') data.inStock += 1;
      if (i.status === 'in_use') data.inUse += 1;
      if (i.status === 'depleted') data.depleted += 1;
    });

    return Array.from(lotMap.values());
  }, [items]);

  // Statistics
  const inStockCount = items.filter(i => i.status === 'in_stock').length;
  const inUseCount = items.filter(i => i.status === 'in_use').length;
  const depletedCount = items.filter(i => i.status === 'depleted').length;

  return (
    <div className="space-y-6" id="strip-reagent-stock-container">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 border border-slate-700 animate-bounce">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span className="text-xs font-bold">{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start space-x-4">
          <div className="w-13 h-13 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-extrabold shadow-lg shadow-emerald-600/25 shrink-0">
            <Package size={26} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5 flex-wrap">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                คลังวัสดุแผ่นตรวจ (Test Strip) & น้ำยาควบคุม (Lab Internal Stock)
              </h2>
              <span className="text-[11px] font-black px-3 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                Unit Barcode Tracking
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              ตารางข้อมูลดิบ (Raw Data Table) & บาร์โค้ดรายกล่อง/ขวด สำหรับห้องแล็บใช้เอง (ตัดใช้ทีละ 1 กล่อง)
            </p>
          </div>
        </div>

        {/* Action Button & Counters */}
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => {
              setBarcodePrinterSource('stock');
              setSelectedItemCodeForPrint(undefined);
              setIsBarcodePrinterOpen(true);
            }}
            className="px-4 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white text-xs font-black flex items-center space-x-2 transition-all cursor-pointer shadow-md shadow-sky-600/20"
            id="btn-open-stock-barcode-printer"
          >
            <Printer size={16} />
            <span>พิมพ์สติกเกอร์ 50x25 mm</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDisburseModalOpen(true)}
            className="px-4 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-black flex items-center space-x-2 transition-all cursor-pointer shadow-md shadow-amber-600/20"
          >
            <BatteryCharging size={16} />
            <span>+ บันทึกการเบิกถ่าน</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black flex items-center space-x-2 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
          >
            <Plus size={18} />
            <span>+ รับเข้าพัสดุ (Gen รหัสรายกล่อง)</span>
          </button>

          <div className="flex items-center space-x-2">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2 rounded-2xl border border-emerald-200/80 dark:border-emerald-800 text-xs text-center min-w-[85px]">
              <span className="text-emerald-600 dark:text-emerald-400 block text-[10px] font-bold">ยังไม่เปิด</span>
              <span className="text-base font-black text-emerald-700 dark:text-emerald-300">{inStockCount} รายการ</span>
            </div>
            <div className="bg-sky-50 dark:bg-sky-950/40 px-3.5 py-2 rounded-2xl border border-sky-200/80 dark:border-sky-800 text-xs text-center min-w-[85px]">
              <span className="text-sky-600 dark:text-sky-400 block text-[10px] font-bold">กำลังใช้งาน</span>
              <span className="text-base font-black text-sky-700 dark:text-sky-300">{inUseCount} รายการ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'items'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <TableIcon size={15} />
            <span>ตารางพัสดุรายกล่อง (Unit Raw Data) ({items.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('barcode_sheet')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'barcode_sheet'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <Barcode size={15} />
            <span>แผ่นพิมพ์บาร์โค้ดติดกล่อง (Barcode Labels)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('lots')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'lots'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <Layers size={15} />
            <span>สรุปยอดคงเหลือตาม LOT ({lotSummaryList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('batteries')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'batteries'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <Battery size={15} className="text-amber-500" />
            <span>คลังและการเบิกถ่าน (Batteries) ({batteryDisbursements.length})</span>
          </button>
        </div>

        {/* Display Toggle (Table vs Cards) */}
        {activeTab === 'items' && (
          <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <TableIcon size={14} />
              <span>ตารางข้อมูล (Table)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid size={14} />
              <span>การ์ด (Cards)</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาตาม Unit ID, Barcode, LOT Number..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>

        {/* Filter Buttons */}
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
              <Droplet size={13} />
              <span>Test Strip</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory('control_solution')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                filterCategory === 'control_solution' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <FlaskConical size={13} />
              <span>Control Solution</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory('battery')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                filterCategory === 'battery' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Battery size={13} />
              <span>ถ่านแบตเตอรี่</span>
            </button>
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="all">ทุกสถานะกล่อง</option>
            <option value="in_stock">ยังไม่เปิดใช้งาน (In Stock)</option>
            <option value="in_use">กำลังใช้งานในแล็บ (In Use)</option>
            <option value="depleted">ใช้งานหมดแล้ว (Depleted)</option>
          </select>
        </div>
      </div>

      {/* TAB 1: Individual Items (Raw Data Table or Cards) */}
      {activeTab === 'items' && (
        <>
          {viewMode === 'table' ? (
            /* RAW DATA TABLE VIEW */
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Unit Item Code & Barcode</th>
                      <th className="py-3.5 px-4">ประเภทพัสดุ</th>
                      <th className="py-3.5 px-4">LOT Number</th>
                      <th className="py-3.5 px-4">วันรับเข้า</th>
                      <th className="py-3.5 px-4">วันหมดอายุ (Exp)</th>
                      <th className="py-3.5 px-4">วันเปิดใช้ (Open Date)</th>
                      <th className="py-3.5 px-4">หมดอายุหลังเปิด (Open Exp)</th>
                      <th className="py-3.5 px-4">สถานะ</th>
                      <th className="py-3.5 px-4 text-center">จัดการตัดสต็อกแล็บ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                          ไม่พบรายการพัสดุในคลัง
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => (
                        <tr 
                          key={item.id} 
                          className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                            item.status === 'in_use' ? 'bg-sky-50/20 dark:bg-sky-950/20' : ''
                          }`}
                        >
                          {/* Unit Code & Visual Barcode */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-3">
                              <BarcodeSvg text={item.itemCode} height={28} width={130} />
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black border ${
                              item.itemType === 'control_solution'
                                ? 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}>
                              {item.itemType === 'control_solution' ? <FlaskConical size={12} /> : <Droplet size={12} />}
                              <span>{item.itemType === 'control_solution' ? 'Control' : 'Test Strip'}</span>
                            </span>
                          </td>

                          {/* LOT Number */}
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-extrabold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                              {item.lotNumber}
                            </span>
                          </td>

                          {/* Received Date */}
                          <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                            {item.receivedDate}
                          </td>

                          {/* Exp Date */}
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {item.expDate}
                          </td>

                          {/* Open Date */}
                          <td className="py-3.5 px-4 font-mono text-sky-700 dark:text-sky-300 font-bold">
                            {item.openDate || '-'}
                          </td>

                          {/* Open Exp Date */}
                          <td className="py-3.5 px-4 font-mono text-amber-700 dark:text-amber-300 font-bold">
                            {item.openExpDate || '-'}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {item.status === 'in_stock' ? (
                              <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                                📦 พร้อมเปิดใช้
                              </span>
                            ) : item.status === 'in_use' ? (
                              <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-sky-100 text-sky-800 border border-sky-200 animate-pulse whitespace-nowrap">
                                ⚡ กำลังใช้งาน
                              </span>
                            ) : (
                              <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                                ✓ ใช้หมดแล้ว
                              </span>
                            )}
                          </td>

                          {/* Action Button & Print */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                type="button"
                                title="พิมพ์สติกเกอร์บาร์โค้ด 50x25 mm สำหรับกล่องนี้"
                                onClick={() => {
                                  setSelectedItemCodeForPrint(item.itemCode);
                                  setBarcodePrinterSource('stock');
                                  setIsBarcodePrinterOpen(true);
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-sky-600 hover:border-sky-300 cursor-pointer transition-all"
                              >
                                <Printer size={13} />
                              </button>

                              <button
                                type="button"
                                title="แก้ไขข้อมูลพัสดุชิ้นนี้"
                                onClick={() => setEditingItem(item)}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:border-amber-300 cursor-pointer transition-all"
                              >
                                <Edit2 size={13} />
                              </button>

                              <button
                                type="button"
                                title="ลบพัสดุชิ้นนี้"
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:border-rose-300 cursor-pointer transition-all"
                              >
                                <Trash2 size={13} />
                              </button>

                              {item.status === 'in_stock' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenItemForLabUse(item)}
                                  className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs inline-flex items-center space-x-1 shadow-xs transition-all cursor-pointer"
                                >
                                  <Play size={12} />
                                  <span>เปิดใช้งาน</span>
                                </button>
                              )}
                              {item.status === 'in_use' && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkAsDepleted(item)}
                                  className="py-1.5 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs inline-flex items-center space-x-1 transition-all cursor-pointer"
                                >
                                  <CheckCircle2 size={12} />
                                  <span>บันทึกหมดแล้ว</span>
                                </button>
                              )}
                              {item.status === 'depleted' && (
                                <span className="text-[11px] text-slate-400 italic">ปิดรอบแล้ว</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* CARDS VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <div 
                  key={item.id}
                  className={`bg-white dark:bg-slate-900 rounded-3xl border p-5 space-y-4 shadow-2xs transition-all hover:shadow-md ${
                    item.status === 'in_use'
                      ? 'border-sky-300 dark:border-sky-900/60 bg-sky-50/15'
                      : item.status === 'depleted'
                      ? 'border-slate-200 dark:border-slate-800 opacity-60 bg-slate-50/40'
                      : 'border-slate-200/90 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border ${
                      item.itemType === 'control_solution'
                        ? 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                    }`}>
                      {item.itemType === 'control_solution' ? <FlaskConical size={14} /> : <Droplet size={14} />}
                      <span>{item.itemType === 'control_solution' ? 'Control Solution' : 'Test Strip'}</span>
                    </span>

                    <div>
                      {item.status === 'in_stock' ? (
                        <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200">
                          📦 พร้อมเปิดใช้
                        </span>
                      ) : item.status === 'in_use' ? (
                        <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-sky-100 text-sky-800 border border-sky-200 animate-pulse">
                          ⚡ กำลังใช้งาน
                        </span>
                      ) : (
                        <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                          ✓ ใช้หมดแล้ว
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Visual Barcode in Card */}
                  <div className="flex justify-center p-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <BarcodeSvg text={item.itemCode} height={36} width={160} />
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                    LOT: <span className="font-extrabold text-slate-900 dark:text-white font-mono">{item.lotNumber}</span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl space-y-1.5 text-xs border border-slate-100 dark:border-slate-700 font-medium">
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                      <span className="text-slate-500">วันหมดอายุ (ฉลาก):</span>
                      <span className="font-bold text-slate-900 dark:text-white font-mono">{item.expDate}</span>
                    </div>
                    {item.openDate && (
                      <div className="flex items-center justify-between text-sky-700 dark:text-sky-300 font-bold">
                        <span>เปิดใช้ในแล็บ:</span>
                        <span className="font-mono">{item.openDate}</span>
                      </div>
                    )}
                    {item.openExpDate && (
                      <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 font-bold">
                        <span>หมดอายุหลังเปิด:</span>
                        <span className="font-mono">{item.openExpDate}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        title="แก้ไขข้อมูลพัสดุชิ้นนี้"
                        onClick={() => setEditingItem(item)}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:border-amber-300 cursor-pointer transition-all"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        title="ลบพัสดุชิ้นนี้"
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:border-rose-300 cursor-pointer transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                      <button
                        type="button"
                        title="พิมพ์สติกเกอร์บาร์โค้ด"
                        onClick={() => {
                          setSelectedItemCodeForPrint(item.itemCode);
                          setBarcodePrinterSource('stock');
                          setIsBarcodePrinterOpen(true);
                        }}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-sky-600 hover:border-sky-300 cursor-pointer transition-all"
                      >
                        <Printer size={13} />
                      </button>
                    </div>

                    {item.status === 'in_stock' && (
                      <button
                        type="button"
                        onClick={() => handleOpenItemForLabUse(item)}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <Play size={13} />
                        <span>เปิดใช้งาน</span>
                      </button>
                    )}
                    {item.status === 'in_use' && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsDepleted(item)}
                        className="w-full py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-black text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                      >
                        <CheckCircle2 size={13} />
                        <span>บันทึกหมดแล้ว</span>
                      </button>
                    )}
                    {item.status === 'depleted' && (
                      <span className="text-xs text-slate-400 italic w-full text-right">ปิดรอบแล้ว</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 2: Printable Barcode Labels Sheet */}
      {activeTab === 'barcode_sheet' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                แผ่นพิมพ์สติกเกอร์บาร์โค้ดประจำกล่อง (Printable Barcode Sheet)
              </h3>
              <p className="text-xs text-slate-500">
                พิมพ์บาร์โค้ดเพื่อนำไปติดข้างกล่องแถบตรวจและขวดน้ำยาควบคุมสำหรับสแกนตัดสต็อกในแล็บ
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-2 cursor-pointer shadow-md"
            >
              <Printer size={15} />
              <span>พิมพ์สติกเกอร์บาร์โค้ด (Print)</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filteredItems.map((item) => (
              <div 
                key={item.id}
                className="p-3 bg-white border border-slate-300 rounded-xl text-center space-y-1.5 shadow-2xs text-slate-900"
              >
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  {item.itemType === 'control_solution' ? 'Control Solution' : 'VivaChek Fad Strip'}
                </div>
                <div className="flex justify-center py-1">
                  <BarcodeSvg text={item.itemCode} height={38} width={140} />
                </div>
                <div className="text-[10px] font-mono font-bold text-slate-700 flex justify-between px-1">
                  <span>LOT: {item.lotNumber}</span>
                  <span>EXP: {item.expDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Summary by LOT */}
      {activeTab === 'lots' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lotSummaryList.map((lot, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black font-mono text-slate-900 dark:text-white">
                  LOT: {lot.lotNumber}
                </span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {lot.itemType === 'control_solution' ? 'Control' : 'Strip'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[10px] text-emerald-600 block font-bold">คงเหลือ</span>
                  <span className="text-base font-black text-emerald-700 dark:text-emerald-300">{lot.inStock}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800">
                  <span className="text-[10px] text-sky-600 block font-bold">กำลังใช้</span>
                  <span className="text-base font-black text-sky-700 dark:text-sky-300">{lot.inUse}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 block font-bold">หมดแล้ว</span>
                  <span className="text-base font-black text-slate-700 dark:text-slate-300">{lot.depleted}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-500">Exp: <strong className="font-mono text-slate-800 dark:text-slate-200">{lot.expDate}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: Batteries Stock & Disbursement Management */}
      {activeTab === 'batteries' && (
        <div className="space-y-6">
          {/* Battery KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
                <Battery size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">ถ่าน AAA ในคลัง</p>
                <h4 className="text-xl font-black text-slate-900 dark:text-white">
                  {items.filter(i => i.itemType === 'battery' && (i.batteryType === 'AAA' || !i.batteryType) && i.status === 'in_stock').length} <span className="text-xs font-bold text-slate-400">ก้อน</span>
                </h4>
                <p className="text-[10px] text-slate-400">พร้อมใช้งาน (Standard DTX)</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                <Battery size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">ถ่าน AA ในคลัง</p>
                <h4 className="text-xl font-black text-slate-900 dark:text-white">
                  {items.filter(i => i.itemType === 'battery' && i.batteryType === 'AA' && i.status === 'in_stock').length} <span className="text-xs font-bold text-slate-400">ก้อน</span>
                </h4>
                <p className="text-[10px] text-slate-400">พร้อมใช้งาน</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center shrink-0">
                <Battery size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">CR2032 / อื่นๆ</p>
                <h4 className="text-xl font-black text-slate-900 dark:text-white">
                  {items.filter(i => i.itemType === 'battery' && (i.batteryType === 'CR2032' || i.batteryType === 'other') && i.status === 'in_stock').length} <span className="text-xs font-bold text-slate-400">ก้อน</span>
                </h4>
                <p className="text-[10px] text-slate-400">พร้อมใช้งาน</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                <BatteryCharging size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">ยอดเบิกถ่านสะสม</p>
                <h4 className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {batteryDisbursements.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)} <span className="text-xs font-bold text-slate-400">ก้อน</span>
                </h4>
                <p className="text-[10px] text-slate-400">ทั้งหมด {batteryDisbursements.length} รายการ</p>
              </div>
            </div>
          </div>

          {/* Sub-view Switcher & Actions */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setBatterySubView('disbursements')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center space-x-2 ${
                  batterySubView === 'disbursements'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <BatteryCharging size={15} />
                <span>ประวัติการเบิกเปลี่ยนถ่าน ({batteryDisbursements.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setBatterySubView('inventory')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center space-x-2 ${
                  batterySubView === 'inventory'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <Battery size={15} />
                <span>รายการถ่านในคลัง ({items.filter(i => i.itemType === 'battery').length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsDisburseModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black flex items-center space-x-1.5 shadow-md shadow-amber-600/20 cursor-pointer transition-all"
              >
                <Plus size={16} />
                <span>+ บันทึกการเบิกถ่าน</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormData({
                    ...initialFormState,
                    category: 'battery',
                    batteryType: 'AAA',
                    boxCount: 10,
                    manufacturer: 'Panasonic'
                  });
                  setIsModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black flex items-center space-x-1.5 shadow-md cursor-pointer transition-all dark:bg-slate-100 dark:text-slate-900"
              >
                <Plus size={16} />
                <span>+ รับถ่านเข้าคลัง</span>
              </button>
            </div>
          </div>

          {/* Battery Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={batterySearch}
                onChange={(e) => setBatterySearch(e.target.value)}
                placeholder="ค้นหาตาม หน่วยงาน, S/N, BGM Code, ผู้ขอเบิก..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={batteryTypeFilter}
                onChange={(e) => setBatteryTypeFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="all">ทุกชนิดถ่าน</option>
                <option value="AAA">ถ่าน AAA (สำหรับ DTX)</option>
                <option value="AA">ถ่าน AA</option>
                <option value="CR2032">ถ่านกระดุม CR2032</option>
                <option value="other">อื่นๆ</option>
              </select>
            </div>
          </div>

          {/* SUB-VIEW 1: DISBURSEMENTS HISTORY TABLE */}
          {batterySubView === 'disbursements' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">วันที่เบิก</th>
                      <th className="py-3.5 px-4">หน่วยงานที่เบิก</th>
                      <th className="py-3.5 px-4">เครื่อง DTX (Code / SN)</th>
                      <th className="py-3.5 px-4">ชนิดถ่าน & จำนวน</th>
                      <th className="py-3.5 px-4">ผู้ขอเบิก / ผู้รับ</th>
                      <th className="py-3.5 px-4">ผู้จ่ายถ่าน (แล็บ)</th>
                      <th className="py-3.5 px-4">สาเหตุการเบิก</th>
                      <th className="py-3.5 px-4">หมายเหตุ</th>
                      <th className="py-3.5 px-4 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {batteryDisbursements.filter(r => {
                      const matchesType = batteryTypeFilter === 'all' || r.batteryType === batteryTypeFilter;
                      const q = batterySearch.trim().toLowerCase();
                      const matchesSearch = !q ||
                        r.ward.toLowerCase().includes(q) ||
                        (r.bgmCode && r.bgmCode.toLowerCase().includes(q)) ||
                        (r.serialNumber && r.serialNumber.toLowerCase().includes(q)) ||
                        r.requesterName.toLowerCase().includes(q) ||
                        r.reason.toLowerCase().includes(q);
                      return matchesType && matchesSearch;
                    }).length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                          ยังไม่มีประวัติการเบิกถ่าน
                        </td>
                      </tr>
                    ) : (
                      batteryDisbursements
                        .filter(r => {
                          const matchesType = batteryTypeFilter === 'all' || r.batteryType === batteryTypeFilter;
                          const q = batterySearch.trim().toLowerCase();
                          const matchesSearch = !q ||
                            r.ward.toLowerCase().includes(q) ||
                            (r.bgmCode && r.bgmCode.toLowerCase().includes(q)) ||
                            (r.serialNumber && r.serialNumber.toLowerCase().includes(q)) ||
                            r.requesterName.toLowerCase().includes(q) ||
                            r.reason.toLowerCase().includes(q);
                          return matchesType && matchesSearch;
                        })
                        .map((rec) => (
                          <tr key={rec.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                              {rec.date}
                            </td>
                            <td className="py-3.5 px-4 font-extrabold text-slate-900 dark:text-white">
                              {rec.ward}
                            </td>
                            <td className="py-3.5 px-4 font-mono">
                              {rec.bgmCode || rec.serialNumber ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold">
                                  {rec.bgmCode ? `${rec.bgmCode}` : ''}
                                  {rec.serialNumber && rec.bgmCode ? ` (${rec.serialNumber})` : rec.serialNumber}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">ไม่ระบุเครื่อง</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black border bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300">
                                <Battery size={12} />
                                <span>{rec.batteryType} • {rec.quantity} ก้อน</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                              {rec.requesterName}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                              {rec.dispenserName || 'เจ้าหน้าที่ห้องแล็บ'}
                            </td>
                            <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                              {rec.reason}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                              {rec.notes || '-'}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteDisbursement(rec.id)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer transition-colors"
                                title="ลบรายการ"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-VIEW 2: BATTERY INVENTORY TABLE */}
          {batterySubView === 'inventory' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Unit Item Code & บาร์โค้ด</th>
                      <th className="py-3.5 px-4">ชนิดถ่าน</th>
                      <th className="py-3.5 px-4">LOT Number</th>
                      <th className="py-3.5 px-4">ผู้ผลิต / ยี่ห้อ</th>
                      <th className="py-3.5 px-4">วันรับเข้า</th>
                      <th className="py-3.5 px-4">วันหมดอายุ (Exp)</th>
                      <th className="py-3.5 px-4">สถานะ</th>
                      <th className="py-3.5 px-4 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {items.filter(i => i.itemType === 'battery').length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                          ยังไม่มีสต็อกถ่านในคลัง กด "+ รับถ่านเข้าคลัง" เพื่อบันทึกรับเข้า
                        </td>
                      </tr>
                    ) : (
                      items
                        .filter(i => i.itemType === 'battery')
                        .filter(i => batteryTypeFilter === 'all' || (i.batteryType || 'AAA') === batteryTypeFilter)
                        .filter(i => {
                          const q = batterySearch.trim().toLowerCase();
                          return !q || i.itemCode.toLowerCase().includes(q) || i.lotNumber.toLowerCase().includes(q);
                        })
                        .map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3.5 px-4">
                              <BarcodeSvg text={item.itemCode} height={26} width={120} />
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black border bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300">
                                <Battery size={12} />
                                <span>{item.batteryType || 'AAA'}</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                              {item.lotNumber}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                              {item.manufacturer || 'Panasonic'}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                              {item.receivedDate}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                              {item.expDate}
                            </td>
                            <td className="py-3.5 px-4">
                              {item.status === 'in_stock' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                                  พร้อมใช้งาน
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold text-[11px]">
                                  เบิกใช้แล้ว
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer transition-colors"
                                title="ลบรายการ"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DISBURSE BATTERY MODAL */}
      {isDisburseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-up overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow-md shadow-amber-500/20">
                  <BatteryCharging size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    บันทึกการเบิกถ่านประจำเครื่อง DTX
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    บันทึกรายการเบิกเปลี่ยนถ่านสำหรับเครื่องตรวจน้ำตาลในโรงพยาบาล
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDisburseModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitDisburse} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-bold">
              {/* Target Machine Selection */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  เลือกเครื่อง DTX ที่มาเบิกถ่าน (หรือพิมพ์ระบุ)
                </label>
                <select
                  value={disburseForm.bgmCode || ''}
                  onChange={(e) => {
                    const selVal = e.target.value;
                    const matchedMachine = machines.find(m => (m.serialNumber || m.machineSerial || m.id) === selVal);
                    setDisburseForm(prev => ({
                      ...prev,
                      bgmCode: matchedMachine?.serialNumber || selVal,
                      serialNumber: matchedMachine?.machineSerial || '',
                      ward: matchedMachine?.ward || prev.ward
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- เลือกเครื่อง DTX ในระบบ (หรือระบุเองด้านล่าง) --</option>
                  {machines.map((m) => (
                    <option key={m.id || m.serialNumber} value={m.serialNumber || m.machineSerial || m.id}>
                      {m.serialNumber} {m.machineSerial ? `(SN: ${m.machineSerial})` : ''} - {m.ward || 'ไม่ระบุตึก'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ward */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  หน่วยงาน / Ward ที่เบิก <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น งานชันสูตรสาธารณสุข, ER, ตึกผู้ป่วยใน"
                  value={disburseForm.ward}
                  onChange={(e) => setDisburseForm(prev => ({ ...prev, ward: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Battery Type & Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    ชนิดถ่าน <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={disburseForm.batteryType}
                    onChange={(e) => setDisburseForm(prev => ({ ...prev, batteryType: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="AAA">ถ่าน AAA (มาตรฐาน DTX 2 ก้อน)</option>
                    <option value="AA">ถ่าน AA</option>
                    <option value="CR2032">ถ่านกระดุม CR2032</option>
                    <option value="other">อื่นๆ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    จำนวนก้อน <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    required
                    value={disburseForm.quantity}
                    onChange={(e) => setDisburseForm(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 text-center font-bold"
                  />
                </div>
              </div>

              {/* Requester & Dispenser */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    ผู้ขอเบิก / ผู้รับถ่าน <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ชื่อเจ้าหน้าที่ผู้รับ"
                    value={disburseForm.requesterName}
                    onChange={(e) => setDisburseForm(prev => ({ ...prev, requesterName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    เจ้าหน้าที่แล็บผู้จ่าย
                  </label>
                  <input
                    type="text"
                    value={disburseForm.dispenserName}
                    onChange={(e) => setDisburseForm(prev => ({ ...prev, dispenserName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  สาเหตุการเบิก / เปลี่ยนถ่าน
                </label>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  {['ถ่านหมดระหว่างตรวจ', 'เครื่องแจ้ง Low Battery', 'เปลี่ยนตามรอบบำรุงรักษา', 'สำรองประจำวอร์ด'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setDisburseForm(prev => ({ ...prev, reason: r }))}
                      className={`py-1 px-2 rounded-lg text-[11px] border transition-all text-left truncate cursor-pointer ${
                        disburseForm.reason === r
                          ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={disburseForm.reason}
                  onChange={(e) => setDisburseForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  หมายเหตุเพิ่มเติม
                </label>
                <input
                  type="text"
                  placeholder="เช่น ตรวจสอบพบขั้วถ่านปกติ"
                  value={disburseForm.notes}
                  onChange={(e) => setDisburseForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsDisburseModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black flex items-center space-x-1.5 shadow-md shadow-amber-600/20 cursor-pointer"
                >
                  <Save size={16} />
                  <span>บันทึกการเบิกถ่าน</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inbound Modal with Box Count & Auto Unique Gen */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-up overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-md shadow-emerald-600/20">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    รับเข้าพัสดุ (Inbound & Auto Gen Unit IDs)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    ระบุเลข LOT และจำนวน ระบบจะสร้างรหัสประจำชิ้นพร้อมบาร์โค้ดให้ทันที
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Body */}
            <form id="inbound-form" onSubmit={handleSubmitInbound} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-bold">
              
              {/* Category */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  ประเภทพัสดุรับเข้า <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, category: 'strip', manufacturer: 'VivaChek Fad' }))}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      formData.category === 'strip'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Droplet size={14} />
                    <span>Test Strip</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, category: 'control_solution', manufacturer: 'VivaChek Fad' }))}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      formData.category === 'control_solution'
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <FlaskConical size={14} />
                    <span>Control</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, category: 'battery', batteryType: 'AAA', manufacturer: 'Panasonic' }))}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      formData.category === 'battery'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Battery size={14} />
                    <span>ถ่านแบตเตอรี่</span>
                  </button>
                </div>
              </div>

              {/* Battery Type Selection if category === 'battery' */}
              {formData.category === 'battery' && (
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    ชนิดของถ่าน <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.batteryType}
                    onChange={(e) => setFormData(prev => ({ ...prev, batteryType: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="AAA">ถ่าน AAA (มาตรฐานสำหรับเครื่อง DTX)</option>
                    <option value="AA">ถ่าน AA</option>
                    <option value="CR2032">ถ่านกระดุม CR2032</option>
                    <option value="other">ถ่านชนิดอื่นๆ</option>
                  </select>
                </div>
              )}

              {/* Lot Number */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  เลข Lot / Batch Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={formData.category === 'battery' ? 'เช่น PANASONIC-AAA-2026 หรือ LOT-BAT-01' : 'เช่น 2026-A หรือ CTRL-2026-B'}
                  value={formData.lotNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, lotNumber: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Box Count (Quantity) & Exp Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    {formData.category === 'battery' ? 'จำนวนก้อนที่รับเข้า' : 'จำนวนกล่องที่รับเข้า'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    required
                    value={formData.boxCount}
                    onChange={(e) => setFormData(prev => ({ ...prev, boxCount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block font-medium">
                    (ระบบจะ Gen บาร์โค้ดให้ {formData.boxCount} {formData.category === 'battery' ? 'ก้อน' : 'กล่อง'})
                  </span>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    วันหมดอายุ (Exp Date) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.expDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, expDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Manufacturer */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  ผู้ผลิต / แบรนด์ (Manufacturer)
                </label>
                <input
                  type="text"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  หมายเหตุเพิ่มเติม
                </label>
                <input
                  type="text"
                  placeholder="เช่น รับเข้าจากคลังพัสดุ รพ."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

            </form>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end space-x-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer transition-all"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                form="inbound-form"
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center space-x-2 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all"
              >
                <Save size={16} />
                <span>บันทึกรับเข้าพัสดุ</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Individual Item Editing Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 shrink-0">
              <div className="flex items-center space-x-2">
                <Edit2 className="text-amber-600" size={18} />
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  แก้ไขข้อมูลพัสดุรายชิ้น
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form id="edit-item-form" onSubmit={handleSaveEditedItem} className="p-6 overflow-y-auto space-y-4 text-xs font-bold">
              
              {/* Item Code */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  รหัสประจำกล่อง (Item Code) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingItem.itemCode}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, itemCode: e.target.value } : null)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              {/* Lot Number */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  เลขล็อต (LOT Number) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingItem.lotNumber}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, lotNumber: e.target.value.toUpperCase() } : null)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  ประเภทพัสดุ <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editingItem.itemType}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, itemType: e.target.value as any } : null)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="strip">Test Strip (แผ่นตรวจน้ำตาล)</option>
                  <option value="control_solution">Control Solution (น้ำยาควบคุมคุณภาพ)</option>
                </select>
              </div>

              {/* Manufacturer */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  ผู้ผลิต / แบรนด์ (Manufacturer)
                </label>
                <input
                  type="text"
                  value={editingItem.manufacturer || ''}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, manufacturer: e.target.value } : null)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    วันที่รับเข้า (Received)
                  </label>
                  <input
                    type="date"
                    value={editingItem.receivedDate}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, receivedDate: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    วันหมดอายุฉลาก (Exp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editingItem.expDate}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, expDate: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  สถานะพัสดุ <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editingItem.status}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, status: e.target.value as any } : null)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="in_stock">📦 พร้อมเปิดใช้งาน (In Stock)</option>
                  <option value="in_use">⚡ กำลังเปิดใช้งานในแล็บ (In Use)</option>
                  <option value="depleted">✓ ใช้หมดแล้ว (Depleted)</option>
                </select>
              </div>

              {/* Open Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    วันที่เปิดใช้งานจริง
                  </label>
                  <input
                    type="date"
                    value={editingItem.openDate || ''}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, openDate: e.target.value || undefined } : null)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    วันหมดอายุหลังเปิด
                  </label>
                  <input
                    type="date"
                    value={editingItem.openExpDate || ''}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, openExpDate: e.target.value || undefined } : null)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  หมายเหตุเพิ่มเติม
                </label>
                <input
                  type="text"
                  value={editingItem.notes || ''}
                  onChange={(e) => setEditingItem(prev => prev ? { ...prev, notes: e.target.value } : null)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

            </form>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end space-x-3 shrink-0">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer transition-all"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                form="edit-item-form"
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs flex items-center space-x-2 shadow-lg shadow-amber-600/20 cursor-pointer transition-all"
              >
                <Save size={16} />
                <span>บันทึกการแก้ไข</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Barcode Printer Modal (50x25 mm) */}
      <BarcodePrinterModal
        isOpen={isBarcodePrinterOpen}
        onClose={() => {
          setIsBarcodePrinterOpen(false);
          setSelectedItemCodeForPrint(undefined);
          setSelectedLotForPrint(undefined);
        }}
        stockItems={items}
        lotConfigs={lotConfigs}
        machines={machines}
        initialSource={barcodePrinterSource}
        initialItemCode={selectedItemCodeForPrint}
        initialLotNumber={selectedLotForPrint}
      />
    </div>
  );
}
