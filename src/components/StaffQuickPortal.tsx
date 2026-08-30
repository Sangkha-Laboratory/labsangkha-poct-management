import React, { useState, useEffect } from 'react';
import { DtxMachine, QcRecord, QcLotConfig, SupplyRequest, DailyChecklist, MaintenanceLog, StripReagentItem } from '../types';
import { dbService } from '../lib/supabase';
import { BarcodePrinterModal } from './BarcodePrinterModal';
import { 
  Zap, 
  TableProperties, 
  Wrench, 
  CheckSquare, 
  CheckCircle2, 
  Sparkles, 
  Trash2, 
  User, 
  Battery, 
  ShieldAlert,
  Info,
  Check,
  RotateCcw,
  ArrowLeft,
  Package,
  Droplet,
  FlaskConical,
  ChevronDown,
  Calendar,
  QrCode,
  PackageCheck,
  Printer,
  Barcode as BarcodeIcon,
  RefreshCw
} from 'lucide-react';

interface StaffQuickPortalProps {
  machines: DtxMachine[];
  qcRecords: QcRecord[];
  lotConfigs: QcLotConfig[];
  supplies?: SupplyRequest[];
  stockItems?: StripReagentItem[];
  onAddQcRecord: (record: QcRecord) => void | Promise<void>;
  onAddSupply?: (supply: SupplyRequest) => Promise<any>;
  onUpdateLotConfigs?: (configs: QcLotConfig[]) => Promise<any>;
  onSwitchToRoleSelector?: () => void;
}

export const StaffQuickPortal: React.FC<StaffQuickPortalProps> = ({
  machines,
  qcRecords,
  lotConfigs,
  supplies = [],
  stockItems = [],
  onAddQcRecord,
  onAddSupply,
  onUpdateLotConfigs,
  onSwitchToRoleSelector
}) => {
  // Smart filter for Lab machines, with graceful fallback to all machines if none matched
  const labMachines = machines.filter(m => {
    const w = (m.ward || '').toLowerCase();
    return w.includes('ชันสูตร') || w.includes('เทคนิคการแพทย์') || w.includes('lab') || w.includes('แล็บ') || w.includes('พยาธิ') || m.ward === 'งานชันสูตรสาธารณสุข';
  });
  const targetMachines = labMachines.length > 0 ? labMachines : machines;

  const [activeTab, setActiveTab] = useState<'batch_qc' | 'checklist' | 'maintenance' | 'supply_request' | 'new_machine_request'>('batch_qc');
  const [isBarcodePrinterOpen, setIsBarcodePrinterOpen] = useState<boolean>(false);
  const [barcodePrinterSource, setBarcodePrinterSource] = useState<'stock' | 'lot' | 'machines' | 'custom'>('stock');

  // Operator name persistence
  const [operator, setOperator] = useState<string>(() => {
    const savedOp = localStorage.getItem('dtx_qc_operator');
    if (savedOp) return savedOp;
    const currentStaffStr = localStorage.getItem('dtx_current_staff');
    if (currentStaffStr) {
      try {
        const u = JSON.parse(currentStaffStr);
        if (u.full_name) return u.full_name;
      } catch {}
    }
    return '';
  });

  const handleOperatorChange = (name: string) => {
    setOperator(name);
    localStorage.setItem('dtx_qc_operator', name);
  };

  // --- BATCH QC ENTRY STATES ---
  const [wardFilter, setWardFilter] = useState<string>('all');
  const [batchDate, setBatchDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [batchLot, setBatchLot] = useState<string>(lotConfigs[0]?.lotNumber || 'LOT2026-A');
  const [batchRows, setBatchRows] = useState<Array<{
    serialNumber: string;
    ward: string;
    selected: boolean;
    level1: string;
    level2: string;
    level3: string;
  }>>([]);
  const [batchToast, setBatchToast] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize batch rows and dropdown serials for machines when data loads
  useEffect(() => {
    if (targetMachines && targetMachines.length > 0) {
      setBatchRows(prev => {
        // If empty or machines changed, regenerate batch rows with selected defaulted to true
        if (prev.length === 0 || prev.length !== targetMachines.length) {
          return targetMachines.map(m => ({
            serialNumber: m.serialNumber || m.machineSerial || m.id || 'DTX-UNK',
            ward: m.ward || 'งานชันสูตรสาธารณสุข',
            selected: true,
            level1: '',
            level2: '',
            level3: ''
          }));
        }
        return prev;
      });

      const labMachine = targetMachines.find(m => {
        const w = (m.ward || '').toLowerCase();
        return w.includes('ชันสูตร') || w.includes('เทคนิคการแพทย์') || w.includes('lab') || w.includes('แล็บ');
      }) || targetMachines[0];
      const defaultMaintSerial = labMachine?.serialNumber || labMachine?.machineSerial || labMachine?.id || '';
      const defaultChkSerial = labMachine?.machineSerial || labMachine?.serialNumber || labMachine?.id || '';
      if (!maintSerial && defaultMaintSerial) setMaintSerial(defaultMaintSerial);
      if (!chkSerial && defaultChkSerial) setChkSerial(defaultChkSerial);
    }
  }, [targetMachines]);

  const activeLotConfig = lotConfigs.find(c => c.lotNumber === batchLot) || lotConfigs[0];

  const uniqueWards = Array.from(new Set(targetMachines.map(m => m.ward || 'ไม่ระบุ'))).filter(Boolean);
  const filteredBatchRows = batchRows.filter(row => wardFilter === 'all' || row.ward === wardFilter);
  const sortedMachinesForSelect = [...targetMachines].sort((a, b) => {
    const aIsLab = (a.ward || '').includes('ชันสูตร') || (a.ward || '').includes('เทคนิคการแพทย์');
    const bIsLab = (b.ward || '').includes('ชันสูตร') || (b.ward || '').includes('เทคนิคการแพทย์');
    if (aIsLab && !bIsLab) return -1;
    if (!aIsLab && bIsLab) return 1;
    return 0;
  });

  const evaluateValue = (valStr: string, min?: number, max?: number, target?: number, sd?: number) => {
    if (!valStr || !valStr.trim()) return 'empty';
    const v = Number(valStr);
    if (isNaN(v)) return 'empty';
    if (min !== undefined && max !== undefined && (min !== 0 || max !== 0)) {
      return (v < min || v > max) ? 'out_of_control' : 'normal';
    }
    if (target !== undefined && sd !== undefined && sd > 0) {
      return (v < target - 3 * sd || v > target + 3 * sd) ? 'out_of_control' : 'normal';
    }
    return 'normal';
  };

  const handleBatchFillSample = (l1: number, l2: number, l3: number) => {
    setBatchRows(prev => prev.map(r => r.selected ? {
      ...r,
      level1: String(l1),
      level2: String(l2),
      level3: String(l3)
    } : r));
    setBatchToast('✓ เติมค่า Target อัตโนมัติสำหรับเครื่องที่เลือกแล้ว');
    setTimeout(() => setBatchToast(''), 3000);
  };

  const handleBatchClearValues = () => {
    setBatchRows(prev => prev.map(r => ({ ...r, level1: '', level2: '', level3: '' })));
  };

  const handleToggleSelectAll = (checked: boolean) => {
    const filteredSerials = filteredBatchRows.map(r => r.serialNumber);
    setBatchRows(prev => prev.map(r => filteredSerials.includes(r.serialNumber) ? { ...r, selected: checked } : r));
  };

  const handleRowChange = (serial: string, field: 'level1' | 'level2' | 'level3' | 'selected', val: any) => {
    setBatchRows(prev => prev.map(r => {
      if (r.serialNumber !== serial) return r;
      const updated = { ...r, [field]: val };
      // Auto-select row if staff types any QC value
      if (field !== 'selected' && String(val).trim() !== '') {
        updated.selected = true;
      }
      return updated;
    }));
  };

  const handleSaveBatchQc = async () => {
    if (!operator.trim()) {
      alert('กรุณาระบุชื่อเจ้าหน้าที่ผู้ตรวจ');
      return;
    }
    // Filter rows that have at least one level entered or are selected with entries
    const rowsWithEntries = batchRows.filter(r => (r.selected || r.level1.trim() || r.level2.trim() || r.level3.trim()) && (r.level1.trim() || r.level2.trim() || r.level3.trim()));
    if (rowsWithEntries.length === 0) {
      alert('กรุณากรอกผลตรวจ QC สำหรับเครื่องที่ต้องการบันทึกอย่างน้อย 1 เครื่อง');
      return;
    }

    if (!activeLotConfig) {
      alert('ไม่พบข้อมูล LOT ควบคุมคุณภาพ กรุณาเลือกล็อตน้ำยา');
      return;
    }

    setIsSubmitting(true);
    try {
      let count = 0;
      for (const row of rowsWithEntries) {
        const l1 = row.level1.trim() !== '' ? Number(row.level1) : activeLotConfig.level1Target;
        const l2 = row.level2.trim() !== '' ? Number(row.level2) : activeLotConfig.level2Target;
        const l3 = row.level3.trim() !== '' ? Number(row.level3) : activeLotConfig.level3Target;

        const l1Status = row.level1.trim() !== '' 
          ? evaluateValue(row.level1, activeLotConfig.level1Min, activeLotConfig.level1Max, activeLotConfig.level1Target, activeLotConfig.level1SD)
          : 'normal';
        const l2Status = row.level2.trim() !== '' 
          ? evaluateValue(row.level2, activeLotConfig.level2Min, activeLotConfig.level2Max, activeLotConfig.level2Target, activeLotConfig.level2SD)
          : 'normal';
        const l3Status = row.level3.trim() !== '' 
          ? evaluateValue(row.level3, activeLotConfig.level3Min, activeLotConfig.level3Max, activeLotConfig.level3Target, activeLotConfig.level3SD)
          : 'normal';

        const record: QcRecord = {
          id: `QC-LAB-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          date: batchDate,
          receiveDate: batchDate,
          returnDate: batchDate,
          ward: row.ward || 'งานชันสูตรสาธารณสุข',
          serialNumber: row.serialNumber,
          operator: operator.trim(),
          lotNumber: batchLot,
          level1: l1,
          level2: l2,
          level3: l3,
          level1Status: l1Status === 'out_of_control' ? 'out_of_control' : 'normal',
          level2Status: l2Status === 'out_of_control' ? 'out_of_control' : 'normal',
          level3Status: l3Status === 'out_of_control' ? 'out_of_control' : 'normal'
        };

        await onAddQcRecord(record);
        count++;
      }

      setBatchToast(`✓ บันทึกผล QC สำเร็จจำนวน ${count} เครื่องเรียบร้อยแล้ว`);
      setTimeout(() => setBatchToast(''), 4000);
      handleBatchClearValues();
    } catch (err: any) {
      console.error(err);
      alert(`เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${err?.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- MAINTENANCE & CHECKLIST STATES ---
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [dailyChecklists, setDailyChecklists] = useState<DailyChecklist[]>([]);
  
  const [isSavingChecklist, setIsSavingChecklist] = useState<boolean>(false);
  const [checklistToast, setChecklistToast] = useState<string>('');

  const [isSavingMaint, setIsSavingMaint] = useState<boolean>(false);
  const [maintToast, setMaintToast] = useState<string>('');

  const [isSavingSupply, setIsSavingSupply] = useState<boolean>(false);
  const [supplyToast, setSupplyToast] = useState<string>('');

  const [internalStockItems, setInternalStockItems] = useState<StripReagentItem[]>(() => {
    if (stockItems && stockItems.length > 0) return stockItems;
    try {
      const saved = localStorage.getItem('dtx_strip_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });


  const [isLoadingQuickWinData, setIsLoadingQuickWinData] = useState<boolean>(false);

  const fetchQuickWinDbData = async () => {
    setIsLoadingQuickWinData(true);
    try {
      const [logs, chks, items, sups] = await Promise.all([
        dbService.getMaintenanceLogs().catch(() => []),
        dbService.getDailyChecklists().catch(() => []),
        dbService.getStripReagentItems().catch(() => []),
        dbService.getSupplies().catch(() => [])
      ]);
      if (logs) {
        setMaintenanceLogs(logs);
      }
      if (chks) {
        setDailyChecklists(chks);
      }
      if (sups) {
        setSupplyRequests(sups.filter(s => s.ward === 'งานชันสูตรสาธารณสุข' || s.itemType === 'strip' || s.itemType === 'control_solution'));
      }
      if (items && items.length > 0) {
        setInternalStockItems(items);
        localStorage.setItem('dtx_strip_items', JSON.stringify(items));
      } else {
        const localSaved = localStorage.getItem('dtx_strip_items');
        if (localSaved) {
          try {
            setInternalStockItems(JSON.parse(localSaved));
          } catch {}
        }
      }
    } catch (err) {
      console.warn('Quick win db fetch notice:', err);
    } finally {
      setIsLoadingQuickWinData(false);
    }
  };

  useEffect(() => {
    fetchQuickWinDbData();
  }, []);

  const handleOpenStockItem = async (item: StripReagentItem) => {
    const today = getThaiTodayDate();
    const cfg = lotConfigs.find(c => c.lotNumber === item.lotNumber);
    const postOpenDays = cfg?.openExpDays || 90;
    
    // Calculate openExpDate
    const openDateObj = new Date(today);
    const expDateObj = new Date(openDateObj);
    expDateObj.setDate(expDateObj.getDate() + postOpenDays);
    const openExpDate = expDateObj.toISOString().split('T')[0];

    const updatedItem: StripReagentItem = {
      ...item,
      status: 'in_use',
      openDate: today,
      openExpDate: openExpDate,
      openedBy: operator.trim() || 'เจ้าหน้าที่แล็บ'
    };

    try {
      await dbService.updateStripReagentItem(item.id, updatedItem);
      const updatedList = internalStockItems.map(i => i.id === item.id ? updatedItem : i);
      setInternalStockItems(updatedList);
      localStorage.setItem('dtx_strip_items', JSON.stringify(updatedList));
      alert(`✓ เปิดใช้งาน ${item.itemCode} เรียบร้อยแล้ว\n📅 วันที่เปิด: ${today}\n⏳ วันหมดอายุหลังเปิด (อยู่ได้ ${postOpenDays} วัน): ${openExpDate}`);
    } catch (err: any) {
      console.warn('DB update failed, saving locally:', err);
      const updatedList = internalStockItems.map(i => i.id === item.id ? updatedItem : i);
      setInternalStockItems(updatedList);
      localStorage.setItem('dtx_strip_items', JSON.stringify(updatedList));
      alert(`✓ บันทึกการเปิดใช้งาน ${item.itemCode} เรียบร้อยแล้ว (บันทึกในเครื่อง)`);
    }
  };

  const handleDepleteStockItem = async (item: StripReagentItem) => {
    if (!confirm(`ยืนยันการบันทึกว่า ${item.itemCode} (LOT ${item.lotNumber}) ใช้งานหมดแล้วหรือไม่?`)) {
      return;
    }

    const updatedItem: StripReagentItem = {
      ...item,
      status: 'depleted'
    };

    try {
      await dbService.updateStripReagentItem(item.id, updatedItem);
      const updatedList = internalStockItems.map(i => i.id === item.id ? updatedItem : i);
      setInternalStockItems(updatedList);
      localStorage.setItem('dtx_strip_items', JSON.stringify(updatedList));
      alert(`✓ บันทึกตัดสต็อก ${item.itemCode} เป็นใช้งานหมดแล้วเรียบร้อย`);
    } catch (err: any) {
      console.warn('DB update failed, saving locally:', err);
      const updatedList = internalStockItems.map(i => i.id === item.id ? updatedItem : i);
      setInternalStockItems(updatedList);
      localStorage.setItem('dtx_strip_items', JSON.stringify(updatedList));
      alert(`✓ บันทึกตัดสต็อก ${item.itemCode} เรียบร้อย`);
    }
  };

  const [maintSerial, setMaintSerial] = useState<string>(targetMachines[0]?.serialNumber || '');
  const [maintType, setMaintType] = useState<'battery_change' | 'cleaning' | 'calibration' | 'repair'>('battery_change');
  const [maintDesc, setMaintDesc] = useState<string>('');

  const handleAddMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operator.trim()) {
      alert('กรุณาระบุชื่อผู้บันทึกการซ่อมบำรุง');
      return;
    }
    if (!maintSerial || !maintDesc.trim()) {
      alert('กรุณากรอกรหัสเครื่องและรายละเอียดการบำรุงรักษา');
      return;
    }

    setIsSavingMaint(true);
    setMaintToast('');

    const newLog: MaintenanceLog = {
      id: `MAINT-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      serialNumber: maintSerial,
      actionType: maintType,
      description: maintDesc.trim(),
      operator: operator.trim()
    };

    try {
      const savedLog = await dbService.insertMaintenanceLog(newLog);
      const updated = [savedLog || newLog, ...maintenanceLogs];
      setMaintenanceLogs(updated);
      setMaintDesc('');
      setMaintToast('✓ บันทึกการซ่อมบำรุง / เปลี่ยนถ่านสำเร็จเรียบร้อยแล้ว!');
      setTimeout(() => setMaintToast(''), 6000);
    } catch (err: any) {
      console.error(err);
      alert(`❌ ไม่สามารถบันทึกข้อมูลการซ่อมบำรุงลงฐานข้อมูลได้: ${err?.message || err}`);
    } finally {
      setIsSavingMaint(false);
    }
  };

  // --- DAILY CHECKLIST ---
  const todayStr = new Date().toISOString().split('T')[0];
  const [chkSerial, setChkSerial] = useState<string>(targetMachines[0]?.machineSerial || targetMachines[0]?.serialNumber || '');
  const [chkBodyClean, setChkBodyClean] = useState<boolean>(true);
  const [chkPowerButton, setChkPowerButton] = useState<boolean>(true);
  const [chkStripSlot, setChkStripSlot] = useState<boolean>(true);
  const [chkBatterySlot, setChkBatterySlot] = useState<boolean>(true);
  const [chkBattery, setChkBattery] = useState<boolean>(true);
  const [chkScreenDisplay, setChkScreenDisplay] = useState<boolean>(true);
  const [chkMeasurement, setChkMeasurement] = useState<boolean>(true);
  const [chkIqcPassed, setChkIqcPassed] = useState<boolean>(true);
  const [chkNote, setChkNote] = useState<string>('');

  const handleSaveDailyChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operator.trim()) {
      alert('กรุณาระบุชื่อผู้ตรวจสอบ Checklist');
      return;
    }
    
    setIsSavingChecklist(true);
    setChecklistToast('');

    const machine = targetMachines.find(m => (m.machineSerial || m.serialNumber) === chkSerial);
    const wardName = machine ? machine.ward : 'งานชันสูตรสาธารณสุข';

    const allPassed = chkBodyClean && chkPowerButton && chkStripSlot && chkBatterySlot && 
                      chkBattery && chkScreenDisplay && chkMeasurement && chkIqcPassed;

    const newChk: DailyChecklist = {
      id: `CHK-${Date.now()}-${chkSerial}`,
      date: todayStr,
      serialNumber: chkSerial,
      ward: wardName,
      chkBodyClean,
      chkPowerButton,
      chkStripSlot,
      chkBatterySlot,
      chkBattery,
      chkScreenDisplay,
      chkMeasurement,
      chkIqcPassed,
      status: allPassed ? 'normal' : 'issue',
      note: chkNote.trim(),
      operator: operator.trim()
    };

    try {
      const savedChk = await dbService.insertDailyChecklist(newChk);
      const updated = [savedChk || newChk, ...dailyChecklists];
      setDailyChecklists(updated);
      setChkNote('');
      setChecklistToast(`✓ บันทึก Checklist ประจำวันสำหรับเครื่อง ${chkSerial} สำเร็จแล้ว!`);
      setTimeout(() => setChecklistToast(''), 6000);
    } catch (err: any) {
      console.error(err);
      alert(`❌ ไม่สามารถบันทึกข้อมูล Checklist ลงฐานข้อมูลได้: ${err?.message || err}`);
    } finally {
      setIsSavingChecklist(false);
    }
  };

  // --- QC HISTORY FILTER STATES ---
  const [qcSearchSerial, setQcSearchSerial] = useState<string>('');
  const [qcFilterStatus, setQcFilterStatus] = useState<'all' | 'in_control' | 'out_of_control'>('all');

  const filteredQcRecords = (qcRecords || [])
    .filter(r => r.ward === 'งานชันสูตรสาธารณสุข')
    .filter(r => {
      if (!qcSearchSerial.trim()) return true;
      return r.serialNumber.toLowerCase().includes(qcSearchSerial.trim().toLowerCase());
    })
    .filter(r => {
      const isInControl = r.level1Status !== 'out_of_control' && r.level2Status !== 'out_of_control' && r.level3Status !== 'out_of_control';
      if (qcFilterStatus === 'in_control') return isInControl;
      if (qcFilterStatus === 'out_of_control') return !isInControl;
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // --- SUPPLY REQUEST STATES (STAFF REQUISITION FLOW) ---
  const getThaiTodayDate = () => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  };

  const [supplyRequests, setSupplyRequests] = useState<SupplyRequest[]>([]);
  const [supItemType, setSupItemType] = useState<'strip' | 'control_solution'>('strip');
  const [supLotNumber, setSupLotNumber] = useState<string>('');
  const [supExpiryDate, setSupExpiryDate] = useState<string>('');
  const [supQuantity, setSupQuantity] = useState<number>(1);
  const [supReason, setSupReason] = useState<string>('เบิกใช้งานประจำวัน งานชันสูตร');
  
  // Requisition specific fields
  const [supBarcode, setSupBarcode] = useState<string>('');
  const [supIssueDate, setSupIssueDate] = useState<string>(getThaiTodayDate);
  const [supTestsPerBox, setSupTestsPerBox] = useState<number>(50);
  const [supPostOpenDays, setSupPostOpenDays] = useState<string>('90');
  const [supReceivedDate, setSupReceivedDate] = useState<string>(getThaiTodayDate);

  // Control solution open stability
  const [supOpenStability, setSupOpenStability] = useState<string>('90');
  
  // Checklist Detail Modal
  const [selectedChecklistDetail, setSelectedChecklistDetail] = useState<DailyChecklist | null>(null);

  // Merge prop lotConfigs with any unique lots found in internalStockItems to ensure dropdown is never empty
  const activeLotConfigs = React.useMemo(() => {
    const map = new Map<string, QcLotConfig>();
    
    // 1. Add from props (highest priority)
    if (Array.isArray(lotConfigs)) {
      lotConfigs.forEach(cfg => {
        if (cfg && cfg.lotNumber) map.set(cfg.lotNumber, cfg);
      });
    }
    
    // 2. Add from internal stock items as fallback
    if (Array.isArray(internalStockItems)) {
      internalStockItems.forEach(item => {
        if (item && item.lotNumber && !map.has(item.lotNumber)) {
          map.set(item.lotNumber, {
            lotNumber: item.lotNumber,
            expDate: item.expDate,
            level1Target: 0, level1Min: 0, level1Max: 0, level1SD: 0,
            level2Target: 0, level2Min: 0, level2Max: 0, level2SD: 0,
            level3Target: 0, level3Min: 0, level3Max: 0, level3SD: 0
          });
        }
      });
    }
    
    return Array.from(map.values());
  }, [lotConfigs, internalStockItems]);

  const handleSelectLotConfig = (selectedLotNum: string) => {
    setSupLotNumber(selectedLotNum);
    const cfg = activeLotConfigs.find(c => c.lotNumber === selectedLotNum);
    if (cfg) {
      if (cfg.barcode) setSupBarcode(cfg.barcode);
      if (cfg.expDate) setSupExpiryDate(cfg.expDate);
      if (cfg.testsPerBox) setSupTestsPerBox(cfg.testsPerBox);
      if (cfg.openExpDays) setSupPostOpenDays(String(cfg.openExpDays));
      if (cfg.receivedDate) setSupReceivedDate(cfg.receivedDate);
    }
  };

  const handleBarcodeChange = (code: string) => {
    setSupBarcode(code);
    const matched = activeLotConfigs.find(c => c.barcode && c.barcode.trim() === code.trim());
    if (matched) {
      setSupLotNumber(matched.lotNumber);
      if (matched.expDate) setSupExpiryDate(matched.expDate);
      if (matched.testsPerBox) setSupTestsPerBox(matched.testsPerBox);
      if (matched.openExpDays) setSupPostOpenDays(String(matched.openExpDays));
      if (matched.receivedDate) setSupReceivedDate(matched.receivedDate);
    }
  };

  useEffect(() => {
    dbService.getSupplies().then((supplies) => {
      if (supplies) {
        setSupplyRequests(supplies.filter(s => s.ward === 'งานชันสูตรสาธารณสุข' || s.itemType === 'strip' || s.itemType === 'control_solution'));
      }
    }).catch(err => {
      console.error('Error fetching supplies:', err);
    });
  }, [activeTab]);

  const handleAddSupplyRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operator.trim()) {
      alert('กรุณาระบุชื่อผู้เบิก');
      return;
    }
    if (!supLotNumber.trim()) {
      alert('กรุณาเลือกล็อตพัสดุในคลังเพื่อเบิกจ่าย');
      return;
    }

    setIsSavingSupply(true);
    setSupplyToast('');

    const details: any = {
      lotNumber: supLotNumber.trim(),
      barcode: supBarcode.trim(),
      expiryDate: supExpiryDate || undefined,
      testsPerBox: supTestsPerBox || 50,
      postOpenDays: Number(supPostOpenDays) || 90,
      receivedDate: supReceivedDate || getThaiTodayDate(),
      openStabilityDays: supOpenStability,
    };

    const newSupply: SupplyRequest = {
      id: `SUP-${Date.now()}`,
      ward: 'งานชันสูตรสาธารณสุข',
      requesterName: operator.trim(),
      itemType: supItemType,
      quantity: Number(supQuantity) || 1,
      reason: supReason.trim() || 'เบิกใช้งานประจำวัน',
      requestDate: getThaiTodayDate(),
      issueDate: supIssueDate || getThaiTodayDate(),
      status: 'approved', // ตัดสต็อกทันทีเมื่อทำการเบิก
      details: details
    };

    try {
      const savedSupply = await dbService.insertSupply(newSupply);
      setSupplyRequests(prev => [savedSupply || newSupply, ...prev]);
      setSupplyToast(`✓ ทำการเบิก ${supItemType === 'strip' ? 'Test Strip (แผ่นตรวจ)' : 'Control Solution (น้ำยาควบคุม)'} จำนวน ${supQuantity} ${supItemType === 'strip' ? 'กล่อง' : 'ขวด'} สำเร็จเรียบร้อยแล้ว!\n🏷️ LOT: ${supLotNumber || '-'}`);
      setTimeout(() => setSupplyToast(''), 6000);
      // Reset form
      setSupLotNumber('');
      setSupBarcode('');
      setSupExpiryDate('');
      setSupQuantity(1);
      setSupReason('เบิกใช้งานประจำวัน งานชันสูตร');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูลการเบิก');
    } finally {
      setIsSavingSupply(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="staff-quick-portal">
      
      {/* Top Staff Banner */}
      <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black shrink-0 shadow-xs">
            <Zap size={24} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                ระบบปฏิบัติการงานชันสูตร (Staff Quick Portal)
              </h2>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-extrabold">
                Lab Member Quick Win
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              โฟกัสเฉพาะเครื่องประจำห้องปฏิบัติการ (งานชันสูตร) • ลงผล QC แบบชุด, เปลี่ยนถ่าน/ซ่อมบำรุง และ Checklist รายวัน
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={fetchQuickWinDbData}
            disabled={isLoadingQuickWinData}
            title="รีเฟรชข้อมูลจากฐานข้อมูล"
            className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <RefreshCw size={15} className={isLoadingQuickWinData ? 'animate-spin text-emerald-600' : ''} />
          </button>

          <div className="flex items-center space-x-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl">
            <User size={14} className="text-emerald-600" />
            <span className="text-slate-500 font-medium">ผู้ปฏิบัติงาน:</span>
            <input
              type="text"
              value={operator}
              onChange={(e) => handleOperatorChange(e.target.value)}
              placeholder="ระบุชื่อเจ้าหน้าที่แล็บ"
              className="font-bold text-slate-800 dark:text-white bg-transparent border-none focus:outline-none w-36 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Navigation for Staff: Dropdown on Mobile (md:hidden), Horizontal Tabs on Desktop (hidden md:flex) */}
      <div className="w-full">
        {/* Mobile Dropdown Navigation */}
        <div className="md:hidden bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs w-full">
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center justify-between">
            <span>เมนูการทำงานหลัก (Mobile Menu):</span>
            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-black">
              {activeTab === 'batch_qc' && 'QC daily'}
              {activeTab === 'checklist' && 'daily maintenance'}
              {activeTab === 'maintenance' && 'ซ่อมบำรุงเปลี่ยนถ่าน'}
              {activeTab === 'supply_request' && 'เบิก Strip/Control'}
              {activeTab === 'new_machine_request' && 'เบิกเครื่องใหม่'}
            </span>
          </label>
          <div className="relative">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as any)}
              className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-extrabold rounded-xl border border-slate-200 dark:border-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
              id="staff-mobile-nav-select"
            >
              <option value="batch_qc">📋 QC daily (บันทึกผล QC รายวัน)</option>
              <option value="checklist">✅ daily maintenance (บำรุงรักษาประจำวัน)</option>
              <option value="maintenance">🔧 ซ่อมบำรุงเปลี่ยนถ่าน</option>
              <option value="supply_request">📦 เบิก Strip / Control (สแกนบาร์โค้ด & ตัดสต็อก)</option>
              <option value="new_machine_request">📟 เบิกเครื่องใหม่ (ยังไม่เปิดใช้งาน)</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronDown size={18} />
            </div>
          </div>
        </div>

        {/* Desktop Horizontal Navigation Sub-tabs */}
        <div className="hidden md:flex items-center p-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs w-full gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('batch_qc')}
            className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              activeTab === 'batch_qc'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
            id="staff-tab-batch-qc"
          >
            <TableProperties size={15} />
            <span>QC daily</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('checklist')}
            className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              activeTab === 'checklist'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
            id="staff-tab-checklist"
          >
            <CheckSquare size={15} />
            <span>daily maintenance</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('maintenance')}
            className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              activeTab === 'maintenance'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
            id="staff-tab-maintenance"
          >
            <Wrench size={15} />
            <span>ซ่อมบำรุงเปลี่ยนถ่าน</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('supply_request')}
            className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              activeTab === 'supply_request'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
            id="staff-tab-supply-request"
          >
            <Package size={15} />
            <span>เบิก Strip/Control</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('new_machine_request')}
            className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              activeTab === 'new_machine_request'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
            id="staff-tab-new-machine-request"
          >
            <span>เบิกเครื่องใหม่ (ยังไม่เปิดใช้งาน)</span>
          </button>
        </div>
      </div>

      {/* TAB 1: QUICK BATCH QC ENTRY (DEFAULTED TO LAB WARD) */}
      {activeTab === 'batch_qc' && (
        <div className="space-y-4 animate-fade-in">
          
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <TableProperties size={16} className="text-emerald-600" />
                  <span>บันทึกผล QC เครื่องห้องปฏิบัติการ (งานชันสูตร) แบบชุดหลายเครื่อง</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  ระบบถูกตั้งค่าเริ่มต้นสำหรับงานชันสูตรโดยเฉพาะ เพื่อความรวดเร็วในการลงผล IQC รอบเช้า
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 font-medium text-xs">หน่วยงาน:</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">งานชันสูตรสาธารณสุข</span>
                </div>
                <div className="flex items-center space-x-1.5 text-xs">
                  <span className="text-slate-500 font-medium">วันที่:</span>
                  <input
                    type="date"
                    value={batchDate}
                    onChange={(e) => setBatchDate(e.target.value)}
                    className="text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold dark:text-white"
                  />
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-500 font-medium">LOT:</span>
                  <select
                    value={batchLot}
                    onChange={(e) => setBatchLot(e.target.value)}
                    className="text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold dark:text-white"
                  >
                    {lotConfigs.map((cfg, idx) => (
                      <option key={idx} value={cfg.lotNumber}>{cfg.lotNumber}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2">
                {activeLotConfig && (
                  <button
                    type="button"
                    onClick={() => handleBatchFillSample(activeLotConfig.level1Target, activeLotConfig.level2Target, activeLotConfig.level3Target)}
                    className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl font-bold flex items-center space-x-1 cursor-pointer transition-all"
                  >
                    <Sparkles size={13} className="text-amber-500" />
                    <span>เติมค่า Target อัตโนมัติ</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleBatchClearValues}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl font-bold flex items-center space-x-1 cursor-pointer transition-all"
                >
                  <Trash2 size={13} className="text-rose-500" />
                  <span>ล้างค่าที่กรอก</span>
                </button>
              </div>

              <div className="font-bold text-slate-500 dark:text-slate-400">
                จำนวนเครื่องในแลปทั้งหมด: <span className="text-emerald-600 font-black">{targetMachines.length}</span> เครื่อง
              </div>
            </div>

            {activeLotConfig && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs flex-wrap gap-2">
                <span className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Info size={14} className="text-emerald-600" />
                  <span>เกณฑ์ประเมิน LOT {batchLot}:</span>
                </span>
                <div className="flex items-center gap-3 font-mono text-[11px] font-bold">
                  <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    L1 Target: {activeLotConfig.level1Target} ({activeLotConfig.level1Min}-{activeLotConfig.level1Max})
                  </span>
                  <span className="text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                    L2 Target: {activeLotConfig.level2Target} ({activeLotConfig.level2Min}-{activeLotConfig.level2Max})
                  </span>
                  <span className="text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                    L3 Target: {activeLotConfig.level3Target} ({activeLotConfig.level3Min}-{activeLotConfig.level3Max})
                  </span>
                </div>
              </div>
            )}
          </div>

          {batchToast && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{batchToast}</span>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold">
                  <tr>
                    <th className="py-3 px-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredBatchRows.length > 0 && filteredBatchRows.every(r => r.selected)}
                        onChange={(e) => handleToggleSelectAll(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3.5 w-12 text-center">#</th>
                    <th className="py-3 px-3.5">หน่วยงาน</th>
                    <th className="py-3 px-3.5 font-mono">รหัสเครื่อง DTX (S/N)</th>
                    <th className="py-3 px-3.5 text-center bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 w-36">Level 1 (Low)</th>
                    <th className="py-3 px-3.5 text-center bg-sky-50/50 dark:bg-sky-950/30 text-sky-900 dark:text-sky-300 w-36">Level 2 (Normal)</th>
                    <th className="py-3 px-3.5 text-center bg-purple-50/50 dark:bg-purple-950/30 text-purple-900 dark:text-purple-300 w-36">Level 3 (High)</th>
                    <th className="py-3 px-3.5 text-center w-28">สถานะประเมิน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredBatchRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">
                        ไม่พบเครื่อง DTX ในงานชันสูตร
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
                        <tr key={idx} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${!row.selected ? 'opacity-50 bg-slate-50/40 dark:bg-slate-900/40' : ''}`}>
                          <td className="py-3 px-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={(e) => handleRowChange(row.serialNumber, 'selected', e.target.checked)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-3.5 font-bold text-slate-800 dark:text-slate-200">{row.ward}</td>
                          <td className="py-3 px-3.5 font-mono font-bold text-emerald-700 dark:text-emerald-400">{row.serialNumber}</td>
                          
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              step="0.1"
                              value={row.level1}
                              onChange={(e) => handleRowChange(row.serialNumber, 'level1', e.target.value)}
                              placeholder={`tgt ${activeLotConfig?.level1Target || ''}`}
                              className={`w-28 text-center text-xs py-1.5 px-2 rounded-lg border font-mono font-bold transition-all ${
                                l1Status === 'out_of_control' 
                                  ? 'bg-rose-100 border-rose-400 text-rose-900' 
                                  : l1Status === 'normal' 
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white'
                              }`}
                            />
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              step="0.1"
                              value={row.level2}
                              onChange={(e) => handleRowChange(row.serialNumber, 'level2', e.target.value)}
                              placeholder={`tgt ${activeLotConfig?.level2Target || ''}`}
                              className={`w-28 text-center text-xs py-1.5 px-2 rounded-lg border font-mono font-bold transition-all ${
                                l2Status === 'out_of_control' 
                                  ? 'bg-rose-100 border-rose-400 text-rose-900' 
                                  : l2Status === 'normal' 
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white'
                              }`}
                            />
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              step="0.1"
                              value={row.level3}
                              onChange={(e) => handleRowChange(row.serialNumber, 'level3', e.target.value)}
                              placeholder={`tgt ${activeLotConfig?.level3Target || ''}`}
                              className={`w-28 text-center text-xs py-1.5 px-2 rounded-lg border font-mono font-bold transition-all ${
                                l3Status === 'out_of_control' 
                                  ? 'bg-rose-100 border-rose-400 text-rose-900' 
                                  : l3Status === 'normal' 
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white'
                              }`}
                            />
                          </td>

                          <td className="py-3 px-3.5 text-center">
                            {!isComplete ? (
                              <span className="text-slate-400 font-normal italic">รอข้อมูล</span>
                            ) : hasOut ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">
                                <ShieldAlert size={10} />
                                <span>Out of Control</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                                <Check size={10} />
                                <span>In Control</span>
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

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                เลือกบันทึกเฉพาะเครื่องที่ติ๊กเลือกและกรอกครบทั้ง 3 ระดับ
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSaveBatchQc}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-md cursor-pointer transition-all disabled:opacity-50"
              >
                <CheckCircle2 size={15} />
                <span>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกผล QC ทั้งหมดที่เลือก'}</span>
              </button>
            </div>
          </div>

          {/* Daily QC Records History */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  ประวัติผลควบคุมคุณภาพ (QC Daily) งานชันสูตรสาธารณสุข
                </h3>
                <p className="text-[10px] text-slate-400">รายการบันทึกผลควบคุมคุณภาพเครื่องประจำห้องปฏิบัติการทั้งหมด</p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="ค้นหาตาม S/N..."
                  value={qcSearchSerial}
                  onChange={(e) => setQcSearchSerial(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-1 focus:ring-emerald-500 outline-none w-32 dark:text-white"
                />
                <select
                  value={qcFilterStatus}
                  onChange={(e) => setQcFilterStatus(e.target.value as any)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-1 focus:ring-emerald-500 outline-none font-bold dark:text-white"
                >
                  <option value="all">ทั้งหมด</option>
                  <option value="in_control">In Control</option>
                  <option value="out_of_control">Out of Control</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800/60">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-800 text-slate-500 font-bold text-[10px] uppercase">
                    <th className="py-2.5 px-3">วันที่ตรวจ</th>
                    <th className="py-2.5 px-3">เครื่อง DTX (S/N)</th>
                    <th className="py-2.5 px-3">Lot Number</th>
                    <th className="py-2.5 px-3 text-center">Level 1</th>
                    <th className="py-2.5 px-3 text-center">Level 2</th>
                    <th className="py-2.5 px-3 text-center">Level 3</th>
                    <th className="py-2.5 px-3">ผู้ลงบันทึก</th>
                    <th className="py-2.5 px-3 text-center">ผลลัพธ์</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredQcRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-400">ไม่พบประวัติผล QC ที่ระบุหรือยังไม่มีข้อมูลบันทึกในระบบ</td>
                    </tr>
                  ) : (
                    filteredQcRecords.map((req, idx) => {
                      const isL1Out = req.level1Status === 'out_of_control';
                      const isL2Out = req.level2Status === 'out_of_control';
                      const isL3Out = req.level3Status === 'out_of_control';
                      const hasOut = isL1Out || isL2Out || isL3Out;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">{req.date}</td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                            {req.serialNumber}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-500">{req.lotNumber}</td>
                          <td className="py-3 px-3 text-center font-mono">
                            <span className={`px-2 py-0.5 rounded font-bold ${isL1Out ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'}`}>
                              {req.level1}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono">
                            <span className={`px-2 py-0.5 rounded font-bold ${isL2Out ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'}`}>
                              {req.level2}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono">
                            <span className={`px-2 py-0.5 rounded font-bold ${isL3Out ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'}`}>
                              {req.level3}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{req.operator}</td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              hasOut
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                            }`}>
                              {hasOut ? 'Out of Control' : 'In Control'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: MAINTENANCE & BATTERY CHANGE */}
      {activeTab === 'maintenance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/80 text-amber-600 rounded-xl">
                <Battery size={20} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  บันทึกซ่อมบำรุง / เปลี่ยนถ่าน
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">บันทึกการเปลี่ยนถ่าน บำรุงรักษาเครื่องแล็บ</p>
              </div>
            </div>

            <form onSubmit={handleAddMaintenance} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  เลือกรหัสเครื่อง DTX (ประจำแลป)
                </label>
                <select
                  value={maintSerial}
                  onChange={(e) => setMaintSerial(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold dark:text-white"
                >
                  {sortedMachinesForSelect.map((m, idx) => {
                    const primarySN = m.machineSerial || m.serialNumber;
                    return (
                      <option key={idx} value={m.serialNumber}>
                        {m.serialNumber} {primarySN && primarySN !== m.serialNumber ? `(S/N: ${primarySN})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ประเภทงานบำรุงรักษา
                </label>
                <select
                  value={maintType}
                  onChange={(e: any) => setMaintType(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold dark:text-white"
                >
                  <option value="battery_change">เปลี่ยนถ่าน (Battery Replacement)</option>
                  <option value="cleaning">ทำความสะอาดช่องตรวจ / เลนส์ (Cleaning)</option>
                  <option value="calibration">ตรวจสอบความเที่ยงตรง (Calibration Check)</option>
                  <option value="repair">ซ่อมแซมแก้ไขเบื้องต้น (Minor Repair)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  รายละเอียดการดำเนินการ
                </label>
                <textarea
                  rows={3}
                  value={maintDesc}
                  onChange={(e) => setMaintDesc(e.target.value)}
                  placeholder="เช่น เปลี่ยนถ่าน AAA ใหม่ 2 ก้อน ทำความสะอาดคราบเลือดและช่องใส่ Test Strip เรียบร้อย"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {maintToast && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-bold animate-pulse">
                  {maintToast}
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingMaint}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-xs cursor-pointer transition-all disabled:opacity-50"
              >
                {isSavingMaint ? (
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                <span>{isSavingMaint ? 'กำลังบันทึกข้อมูล...' : 'บันทึกประวัติการบำรุงรักษา'}</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Wrench size={16} className="text-emerald-600" />
              <span>ประวัติการเปลี่ยนถ่านและซ่อมบำรุงเครื่องแล็บ</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold">
                  <tr>
                    <th className="py-3 px-3">วันที่</th>
                    <th className="py-3 px-3 font-mono">รหัสเครื่อง S/N</th>
                    <th className="py-3 px-3">ประเภทงาน</th>
                    <th className="py-3 px-3">รายละเอียด</th>
                    <th className="py-3 px-3">ผู้บันทึก</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {maintenanceLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400">ยังไม่มีประวัติการบำรุงรักษา</td>
                    </tr>
                  ) : (
                    maintenanceLogs.map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-3 font-mono text-slate-500">{log.date}</td>
                        <td className="py-3 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">{log.serialNumber}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            log.actionType === 'battery_change' ? 'bg-amber-100 text-amber-800' :
                            log.actionType === 'cleaning' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {log.actionType === 'battery_change' ? 'เปลี่ยนถ่าน' :
                             log.actionType === 'cleaning' ? 'ทำความสะอาด' :
                             log.actionType === 'calibration' ? 'ตรวจสอบความเที่ยงตรง' : 'ซ่อมแซม'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{log.description}</td>
                        <td className="py-3 px-3 font-bold text-slate-600 dark:text-slate-400">{log.operator}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: DAILY MAINTENANCE CHECKLIST */}
      {activeTab === 'checklist' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 rounded-xl">
                <CheckSquare size={20} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Checklist บำรุงรักษารายวัน
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">ตรวจสอบประจำวันสำหรับเครื่องประจำแลป</p>
              </div>
            </div>

            <form onSubmit={handleSaveDailyChecklist} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  เลือกรหัสเครื่อง DTX (S/N)
                </label>
                <select
                  value={chkSerial}
                  onChange={(e) => setChkSerial(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold dark:text-white"
                >
                  {sortedMachinesForSelect.map((m, idx) => {
                    const primarySN = m.machineSerial || m.serialNumber;
                    return (
                      <option key={idx} value={primarySN}>
                        S/N: {primarySN} {m.serialNumber && m.serialNumber !== m.machineSerial ? `(รหัส: ${m.serialNumber})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center space-x-3 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <input
                    type="checkbox"
                    checked={chkBodyClean}
                    onChange={(e) => setChkBodyClean(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-slate-700 dark:text-slate-300">1. วัสดุตัวเครื่องและความสะอาด</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <input
                    type="checkbox"
                    checked={chkPowerButton}
                    onChange={(e) => setChkPowerButton(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-slate-700 dark:text-slate-300">2. ปุ่มเปิด/ปิด</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <input
                    type="checkbox"
                    checked={chkStripSlot}
                    onChange={(e) => setChkStripSlot(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-slate-700 dark:text-slate-300">3. ช่องเสียบ Strip</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <input
                    type="checkbox"
                    checked={chkBatterySlot}
                    onChange={(e) => setChkBatterySlot(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-slate-700 dark:text-slate-300">4. ช่องใส่ถ่าน</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <input
                    type="checkbox"
                    checked={chkBattery}
                    onChange={(e) => setChkBattery(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-slate-700 dark:text-slate-300">5. พลังงานแบตเตอรี่และความเรียบร้อย</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <input
                    type="checkbox"
                    checked={chkScreenDisplay}
                    onChange={(e) => setChkScreenDisplay(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-slate-700 dark:text-slate-300">6. ความคมชัดและไฟหน้าจอแสดงผล</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <input
                    type="checkbox"
                    checked={chkMeasurement}
                    onChange={(e) => setChkMeasurement(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-slate-700 dark:text-slate-300">7. ตัวเครื่องอ่านค่าและประมวลผลได้ถูกต้อง</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <input
                    type="checkbox"
                    checked={chkIqcPassed}
                    onChange={(e) => setChkIqcPassed(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-slate-700 dark:text-slate-300">8. ผลทดสอบ IQC ประจำวันอยู่ในย่านควบคุมปกติ</span>
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  บันทึกเพิ่มเติม / ข้อสังเกต (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={chkNote}
                  onChange={(e) => setChkNote(e.target.value)}
                  placeholder="เช่น เครื่องทำงานปกติ พร้อมใช้งาน"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {checklistToast && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-bold animate-pulse">
                  {checklistToast}
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingChecklist}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-xs cursor-pointer transition-all disabled:opacity-50"
              >
                {isSavingChecklist ? (
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                <span>{isSavingChecklist ? 'กำลังบันทึกข้อมูล...' : 'บันทึก Checklist ประจำวัน'}</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <CheckSquare size={16} className="text-emerald-600" />
              <span>ประวัติ Checklist ประจำวันเครื่องแล็บ</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold">
                  <tr>
                    <th className="py-3 px-3">วันที่</th>
                    <th className="py-3 px-3 font-mono">S/N</th>
                    <th className="py-3 px-3">ผลการตรวจ</th>
                    <th className="py-3 px-3">สถานะ</th>
                    <th className="py-3 px-3">ผู้ตรวจ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {dailyChecklists.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400">ยังไม่มีรายการ Checklist วันนี้</td>
                    </tr>
                  ) : (
                    dailyChecklists.map((chk, idx) => {
                      const bodyPassed = chk.chkBodyClean !== undefined ? (chk.chkBodyClean && chk.chkPowerButton && chk.chkStripSlot && chk.chkBatterySlot) : (chk as any).cleanStripPort;
                      const batteryPassed = chk.chkBattery !== undefined ? chk.chkBattery : (chk as any).checkBattery;
                      const screenPassed = chk.chkScreenDisplay !== undefined ? chk.chkScreenDisplay : true;
                      const measurementPassed = chk.chkMeasurement !== undefined ? chk.chkMeasurement : (chk as any).verifyDateTime;
                      const iqcPassed = chk.chkIqcPassed !== undefined ? chk.chkIqcPassed : true;

                      const failures: string[] = [];
                      if (!bodyPassed) failures.push('สภาพตัวเครื่อง');
                      if (!batteryPassed) failures.push('ถ่าน');
                      if (!screenPassed) failures.push('การแสดงผลหน้าจอ');
                      if (!measurementPassed) failures.push('การตรวจวัดค่า');
                      if (!iqcPassed) failures.push('IQC');

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-3 font-mono text-slate-500">{chk.date}</td>
                          <td className="py-3 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">{chk.serialNumber}</td>
                          <td className="py-3 px-3">
                            {failures.length === 0 ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  ✓ สมบูรณ์ผ่านทุกรายการ
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedChecklistDetail(chk)}
                                  className="text-[11px] text-emerald-600 hover:text-emerald-700 underline font-semibold cursor-pointer"
                                >
                                  ดูรายละเอียด
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-rose-600 dark:text-rose-400 font-semibold text-[11px] truncate max-w-[130px]" title={failures.join(', ')}>
                                  ✗ พบข้อสังเกต ({failures.length})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedChecklistDetail(chk)}
                                  className="text-[11px] text-rose-600 hover:text-rose-700 underline font-bold cursor-pointer"
                                >
                                  ดูรายละเอียด
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              chk.status === 'normal' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {chk.status === 'normal' ? 'ปกติ' : 'ผิดปกติ'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-600 dark:text-slate-400">{chk.operator}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* CHECKLIST DETAIL MODAL */}
          {selectedChecklistDetail && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <CheckSquare size={16} className="text-emerald-600" />
                      <span>รายละเอียด Checklist บำรุงรักษารายวัน</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">S/N: {selectedChecklistDetail.serialNumber} • วันที่: {selectedChecklistDetail.date}</p>
                  </div>
                  <button
                    onClick={() => setSelectedChecklistDetail(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1 rounded-lg cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 grid grid-cols-2 gap-2">
                    <div><span className="text-slate-500">ผู้ตรวจสอบ:</span> <strong className="text-slate-800 dark:text-white">{selectedChecklistDetail.operator}</strong></div>
                    <div><span className="text-slate-500">สถานะสรุป:</span> <strong className={selectedChecklistDetail.status === 'normal' ? 'text-emerald-600' : 'text-rose-600'}>{selectedChecklistDetail.status === 'normal' ? 'ปกติ' : 'พบข้อผิดปกติ'}</strong></div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="font-bold text-slate-700 dark:text-slate-300 border-b pb-1">รายการตรวจสอบ 8 ข้อ:</div>
                    <div className="grid grid-cols-1 gap-1 text-[11px]">
                      <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 dark:bg-slate-800/40">
                        <span>1. วัสดุตัวเครื่องและความสะอาด</span>
                        <span className={selectedChecklistDetail.chkBodyClean ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>{selectedChecklistDetail.chkBodyClean ? '✓ ผ่าน' : '✗ ไม่ผ่าน'}</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 dark:bg-slate-800/40">
                        <span>2. ปุ่มเปิด/ปิด</span>
                        <span className={selectedChecklistDetail.chkPowerButton ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>{selectedChecklistDetail.chkPowerButton ? '✓ ผ่าน' : '✗ ไม่ผ่าน'}</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 dark:bg-slate-800/40">
                        <span>3. ช่องเสียบ Strip</span>
                        <span className={selectedChecklistDetail.chkStripSlot ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>{selectedChecklistDetail.chkStripSlot ? '✓ ผ่าน' : '✗ ไม่ผ่าน'}</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 dark:bg-slate-800/40">
                        <span>4. ช่องใส่ถ่าน</span>
                        <span className={selectedChecklistDetail.chkBatterySlot ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>{selectedChecklistDetail.chkBatterySlot ? '✓ ผ่าน' : '✗ ไม่ผ่าน'}</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 dark:bg-slate-800/40">
                        <span>5. พลังงานแบตเตอรี่และความเรียบร้อย</span>
                        <span className={selectedChecklistDetail.chkBattery ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>{selectedChecklistDetail.chkBattery ? '✓ ผ่าน' : '✗ ไม่ผ่าน'}</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 dark:bg-slate-800/40">
                        <span>6. ความคมชัดและไฟหน้าจอแสดงผล</span>
                        <span className={selectedChecklistDetail.chkScreenDisplay ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>{selectedChecklistDetail.chkScreenDisplay ? '✓ ผ่าน' : '✗ ไม่ผ่าน'}</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 dark:bg-slate-800/40">
                        <span>7. ตัวเครื่องอ่านค่าและประมวลผลถูกต้อง</span>
                        <span className={selectedChecklistDetail.chkMeasurement ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>{selectedChecklistDetail.chkMeasurement ? '✓ ผ่าน' : '✗ ไม่ผ่าน'}</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 dark:bg-slate-800/40">
                        <span>8. ผลทดสอบ IQC ประจำวันอยู่ในย่านควบคุม</span>
                        <span className={selectedChecklistDetail.chkIqcPassed ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>{selectedChecklistDetail.chkIqcPassed ? '✓ ผ่าน' : '✗ ไม่ผ่าน'}</span>
                      </div>
                    </div>
                  </div>

                  {selectedChecklistDetail.note && (
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50">
                      <span className="font-bold text-amber-800 dark:text-amber-300">หมายเหตุ / ข้อสังเกต:</span>
                      <p className="text-amber-900 dark:text-amber-200 mt-0.5">{selectedChecklistDetail.note}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setSelectedChecklistDetail(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    ปิดหน้าต่าง
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB 4: SUPPLY REQUEST & LAB STOCK MANAGEMENT */}
      {activeTab === 'supply_request' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Stock KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 shrink-0">
                <Package size={20} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">วัสดุทั้งหมดในคลัง</p>
                <h4 className="text-base font-black text-slate-800 dark:text-white">
                  {internalStockItems.length} <span className="text-xs font-bold text-slate-400">รายการ</span>
                </h4>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/80 text-sky-600 shrink-0">
                <PackageCheck size={20} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">พร้อมใช้งาน (In Stock)</p>
                <h4 className="text-base font-black text-sky-600 dark:text-sky-400">
                  {internalStockItems.filter(i => i.status === 'in_stock').length} <span className="text-xs font-bold text-slate-400">กล่อง/ขวด</span>
                </h4>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 shrink-0">
                <Droplet size={20} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">กำลังเปิดใช้ (In Use)</p>
                <h4 className="text-base font-black text-amber-600 dark:text-amber-400">
                  {internalStockItems.filter(i => i.status === 'in_use').length} <span className="text-xs font-bold text-slate-400">กล่อง/ขวด</span>
                </h4>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/80 text-purple-600 shrink-0">
                <Sparkles size={20} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">ล็อตน้ำยาในระบบ</p>
                <h4 className="text-base font-black text-purple-600 dark:text-purple-400">
                  {lotConfigs.length} <span className="text-xs font-bold text-slate-400">LOTs</span>
                </h4>
              </div>
            </div>
          </div>

          {/* REQUISITION & DISPENSE FORM */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <PackageCheck size={20} className="text-emerald-600" />
                  <span>ระบบทำรายการเบิกจ่ายพัสดุ & ตัดสต็อก (Requisition / Dispense)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  เจ้าหน้าที่ปฏิบัติการสามารถยิงบาร์โค้ดกล่อง หรือเลือกล็อตพัสดุเพื่อทำการเบิกใช้งาน (ระบบบันทึกวันที่เบิก เวลาไทยอัตโนมัติ)
                </p>
              </div>

              <span className="text-xs bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-1.5 self-start sm:self-auto">
                <Calendar size={14} />
                <span>วันที่ทำรายการเบิก: {getThaiTodayDate()}</span>
              </span>
            </div>

            <form onSubmit={handleAddSupplyRequest} className="space-y-6">
              
              {/* Step 1: Requester & Issue Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    ชื่อผู้เบิก (Requester Name) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={operator}
                    onChange={(e) => handleOperatorChange(e.target.value)}
                    placeholder="ระบุชื่อเจ้าหน้าที่ผู้เบิก"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    วันที่ทำรายการเบิก (Issue Date) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={supIssueDate}
                    onChange={(e) => setSupIssueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs"
                  />
                </div>
              </div>

              {/* Step 2: Select Stock Item / Scan Barcode */}
              <div className="p-4 bg-emerald-50/40 dark:bg-slate-950/50 rounded-2xl border border-emerald-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <QrCode size={16} className="text-emerald-600" />
                    <span>เลือกล็อตวัสดุในคลัง (Stock Item Selector)</span>
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">ดึงข้อมูลล็อตและวันหมดอายุอัตโนมัติ</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Barcode Scanner Input */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <BarcodeIcon size={14} className="text-slate-400" />
                      <span>สแกนบาร์โค้ดวัสดุ (Barcode Scan)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="คลิกที่นี่แล้วยิงบาร์โค้ด..."
                      value={supBarcode}
                      onChange={(e) => handleBarcodeChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs"
                    />
                  </div>

                  {/* Select Lot from Inventory */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      รายการและล็อตคงเหลือในคลัง <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={supLotNumber}
                      onChange={(e) => handleSelectLotConfig(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-extrabold focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer shadow-xs"
                    >
                      <option value="">-- เลือกล็อตพัสดุในคลังเพื่อเบิกจ่าย ({activeLotConfigs.length} รายการ) --</option>
                      {activeLotConfigs.map(cfg => (
                        <option key={cfg.lotNumber} value={cfg.lotNumber}>
                          LOT: {cfg.lotNumber} {cfg.manufacturer ? `(${cfg.manufacturer})` : ''} — หมดอายุ: {cfg.expDate || 'ไม่ระบุ'} {cfg.barcode ? `| Barcode: ${cfg.barcode}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Auto-populated Stock Information Card (Non-editable summary) */}
                {supLotNumber && (
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-800/60 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-extrabold text-[11px]">
                        LOT: {supLotNumber}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300 font-medium">
                        วันหมดอายุ: <strong className="text-slate-800 dark:text-white">{supExpiryDate || 'ไม่ระบุ'}</strong>
                      </span>
                    </div>
                    <div className="text-slate-500 text-[11px] font-mono">
                      {supBarcode ? `บาร์โค้ด: ${supBarcode}` : ''}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: Quantity & Reason */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Quantity */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    จำนวนที่เบิก ({supItemType === 'strip' ? 'กล่อง' : 'ขวด'}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={supQuantity}
                    onChange={(e) => setSupQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs"
                  />
                </div>

                {/* Reason / Remarks */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    หมายเหตุ / เหตุผลการเบิกใช้งาน
                  </label>
                  <input
                    type="text"
                    value={supReason}
                    onChange={(e) => setSupReason(e.target.value)}
                    placeholder="เบิกใช้งานประจำวัน งานชันสูตร..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
                <div className="flex-1">
                  {supplyToast && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-bold animate-pulse">
                      {supplyToast}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSavingSupply}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingSupply ? (
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <PackageCheck size={16} />
                  )}
                  <span>{isSavingSupply ? 'กำลังดำเนินการ...' : 'บันทึกการเบิกจ่าย (ตัดสต็อก)'}</span>
                </button>
              </div>

            </form>
          </div>

          {/* History of supply requests */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  ประวัติการส่งเบิกพัสดุ งานชันสูตรสาธารณสุข
                </h3>
                <p className="text-[10px] text-slate-400">รายการเบิกทั้งหมดที่บันทึกผ่านทางหน้าต่าง Quick Win</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800/60">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-800 text-slate-500 font-bold text-[10px] uppercase">
                    <th className="py-2.5 px-3">วันที่ส่ง</th>
                    <th className="py-2.5 px-3">รายการ</th>
                    <th className="py-2.5 px-3">Lot Number</th>
                    <th className="py-2.5 px-3">ข้อมูลจำเพาะ</th>
                    <th className="py-2.5 px-3">จำนวน</th>
                    <th className="py-2.5 px-3">ผู้เบิก</th>
                    <th className="py-2.5 px-3">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {supplyRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">ยังไม่มีประวัติการส่งเบิกในระบบ</td>
                    </tr>
                  ) : (
                    supplyRequests.map((req, idx) => {
                      const det = req.details || {};
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">{req.requestDate}</td>
                          <td className="py-3 px-3">
                            {req.itemType === 'strip' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-bold">
                                <Droplet size={14} className="text-rose-500 shrink-0" />
                                <span>Test Strip</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-300 font-bold">
                                <FlaskConical size={14} className="text-sky-500 shrink-0" />
                                <span>Control Solution</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                            {det.lotNumber || '-'}
                          </td>
                          <td className="py-3 px-3 text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                            <div className="space-y-0.5">
                              <div><span className="font-bold">Exp:</span> {det.expiryDate || '-'}</div>
                              {req.itemType === 'strip' && (
                                <div className="text-[10px] bg-slate-50 dark:bg-slate-950 p-1 rounded font-mono text-slate-500 mt-0.5">
                                  L1: {det.level1Min}-{det.level1Max} | 
                                  L2: {det.level2Min}-{det.level2Max} | 
                                  L3: {det.level3Min}-{det.level3Max}
                                </div>
                              )}
                              {req.itemType === 'control_solution' && (
                                <div><span className="font-bold">อยู่ได้หลังเปิด:</span> {det.openStabilityDays || '90'} วัน</div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                            {req.quantity} {req.itemType === 'strip' ? 'กล่อง' : 'ขวด'}
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{req.requesterName}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              req.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                                : req.status === 'rejected'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                            }`}>
                              {req.status === 'approved' ? 'อนุมัติแล้ว' : req.status === 'rejected' ? 'ปฏิเสธ' : 'รอดำเนินการ'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 5: NEW MACHINE REQUEST (NOT ACTIVE YET) */}
      {activeTab === 'new_machine_request' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 max-w-2xl mx-auto text-center space-y-6 shadow-sm animate-fade-in">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-500 flex items-center justify-center font-black shadow-xs">
            <Sparkles size={32} />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              ระบบเบิกจ่ายเครื่องใหม่ (ยังไม่เปิดใช้งาน)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
              บริการเบิกเครื่องตรวจระดับน้ำตาล DTX ตัวใหม่เข้าระบบ 
               <br />ฟังก์ชันนี้อยู่ระหว่างพัฒนา
            </p>
          </div>



          <p className="text-[11px] text-slate-400">
            หากต้องการทดแทนเครื่องชำรุดกรุณาติดต่อผู้รับผิดชอบโดยตรง
          </p>
        </div>
      )}

      {/* Barcode Printer Modal (50x25 mm) */}
      <BarcodePrinterModal
        isOpen={isBarcodePrinterOpen}
        onClose={() => setIsBarcodePrinterOpen(false)}
        stockItems={internalStockItems}
        lotConfigs={lotConfigs}
        machines={machines}
        initialSource={barcodePrinterSource}
      />

    </div>
  );
};
